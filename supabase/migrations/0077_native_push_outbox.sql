-- UR D.12. USER executes in Dashboard; never executed automatically by the app.
-- Additive, replayable. No backfill of old events. Existing APNs/legacy send hooks stay intact.
BEGIN;
CREATE TABLE IF NOT EXISTS public.native_push_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE,
 recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 kind text NOT NULL,
 source_type text NOT NULL CHECK(source_type IN ('notification','message','invite')),
 source_id uuid NOT NULL,
 actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 available_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','skipped','dead')),
 attempts integer NOT NULL DEFAULT 0,
 lease_until timestamptz,
 lease_token uuid,
 last_error text,
 finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS native_push_pending_idx ON public.native_push_outbox(available_at)
 WHERE status IN ('pending','processing');
ALTER TABLE public.native_push_outbox ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.native_push_deliveries (
 event_id uuid NOT NULL REFERENCES public.native_push_outbox(id) ON DELETE CASCADE,
 device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('sent','dead','skipped')),
 finished_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,device_id)
);
ALTER TABLE public.native_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_push_outbox,public.native_push_deliveries FROM anon,authenticated;
GRANT ALL ON public.native_push_outbox,public.native_push_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_native_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k text; actor uuid; recipient uuid; deadline timestamptz; fields jsonb; m record;
BEGIN
 IF TG_TABLE_NAME='notifications' THEN
  k:=NEW.kind;
  IF k NOT IN ('member_joined','party_cancelled','member_left','member_left_late','reminder_1h',
    'attendance_confirm','complaint_filed','complaint_response_needed','complaint_ack','complaint_result',
    'trust_changed','game_join_request','game_join_result','game_kicked') THEN RETURN NEW; END IF;
  actor:=NEW.actor_id; recipient:=NEW.user_id;
  deadline:=NEW.created_at+interval '24 hours';
  IF k='reminder_1h' THEN deadline:=LEAST(deadline,(NEW.payload->>'start_at')::timestamptz); END IF;
  IF k IN ('game_join_request','game_join_result','game_kicked') THEN
   SELECT LEAST(deadline,gr.expires_at) INTO deadline FROM public.game_rooms gr WHERE gr.id=(NEW.payload->>'room_id')::uuid;
   IF deadline IS NULL THEN RETURN NEW; END IF;
   IF k='game_join_request' THEN deadline:=LEAST(deadline,NEW.created_at+interval '5 minutes'); END IF;
  END IF;
  IF k='attendance_confirm' THEN deadline:=LEAST(deadline,(NEW.payload->>'closes_at')::timestamptz); END IF;
  IF k='complaint_response_needed' THEN deadline:=LEAST(deadline,(NEW.payload->>'response_due_at')::timestamptz); END IF;
  -- complaint_filed and response_needed describe the same action; only one lockscreen alert.
  IF k='complaint_filed' AND EXISTS(SELECT 1 FROM public.notifications n WHERE n.user_id=NEW.user_id
    AND n.kind='complaint_response_needed' AND n.payload->>'complaint_id'=NEW.payload->>'complaint_id') THEN RETURN NEW; END IF;
  fields:=jsonb_strip_nulls(jsonb_build_object('party_id',NEW.party_id,'complaint_id',NEW.payload->>'complaint_id',
    'room_id',NEW.payload->>'room_id','code',NEW.payload->>'room_code','decision',NEW.payload->>'decision'));
  INSERT INTO public.native_push_outbox(event_key,recipient_id,kind,source_type,source_id,actor_id,payload,expires_at)
  VALUES('notice:'||NEW.id,recipient,k,'notification',NEW.id,actor,fields,deadline) ON CONFLICT(event_key) DO NOTHING;
 ELSIF TG_TABLE_NAME='messages' THEN
  FOR m IN SELECT cm.user_id FROM public.conversation_members cm WHERE cm.conversation_id=NEW.conversation_id AND cm.user_id<>NEW.sender_id LOOP
   INSERT INTO public.native_push_outbox(event_key,recipient_id,kind,source_type,source_id,actor_id,payload,expires_at)
   VALUES('message:'||NEW.id||':'||m.user_id,m.user_id,'chat','message',NEW.id,NEW.sender_id,
    jsonb_build_object('conversation_id',NEW.conversation_id),NEW.created_at+interval '24 hours') ON CONFLICT(event_key) DO NOTHING;
  END LOOP;
 ELSIF TG_TABLE_NAME='drink_invites' THEN
  IF TG_OP='INSERT' AND NEW.status='sent' THEN k:='invite';recipient:=NEW.to_user_id;actor:=NEW.from_user_id;
  ELSIF TG_OP='UPDATE' THEN
   IF OLD.status='sent' AND NEW.status IN ('accepted','declined') THEN k:='invite_reply';recipient:=NEW.from_user_id;actor:=NEW.to_user_id;
   ELSE RETURN NEW; END IF;
  ELSE RETURN NEW; END IF;
  IF recipient IS NULL OR actor IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.native_push_outbox(event_key,recipient_id,kind,source_type,source_id,actor_id,payload,expires_at)
  VALUES('invite:'||NEW.id||':'||NEW.status,recipient,k,'invite',NEW.id,actor,
    jsonb_build_object('invite_id',NEW.id,'decision',NEW.status),LEAST(COALESCE(NEW.expires_at,now()+interval '24 hours'),now()+interval '24 hours'))
  ON CONFLICT(event_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_native_push() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS enqueue_native_notice ON public.notifications;
CREATE TRIGGER enqueue_native_notice AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.enqueue_native_push();
DROP TRIGGER IF EXISTS enqueue_native_message ON public.messages;
CREATE TRIGGER enqueue_native_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.enqueue_native_push();
DROP TRIGGER IF EXISTS enqueue_native_invite ON public.drink_invites;
CREATE TRIGGER enqueue_native_invite AFTER INSERT OR UPDATE OF status ON public.drink_invites FOR EACH ROW EXECUTE FUNCTION public.enqueue_native_push();

-- Transactional lifecycle sources missing from the former site-only notice feed.
CREATE OR REPLACE FUNCTION public.native_push_lifecycle_notices()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE host uuid;
BEGIN
 IF TG_TABLE_NAME='joins' THEN
  SELECT host_user_id INTO host FROM public.parties WHERE id=NEW.party_id;
  IF host IS NOT NULL AND host<>NEW.user_id THEN
   INSERT INTO public.notifications(user_id,kind,party_id,actor_id,payload)
   VALUES(host,'member_joined',NEW.party_id,NEW.user_id,jsonb_build_object('join_id',NEW.id));
  END IF;
 ELSIF TG_TABLE_NAME='complaints' THEN
  INSERT INTO public.notifications(user_id,kind,party_id,payload)
  VALUES(NEW.filer_id,'complaint_ack',NEW.party_id,jsonb_build_object('complaint_id',NEW.id));
  IF NEW.status='awaiting_response' AND NEW.response_due_at>now()
   AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
   INSERT INTO public.notifications(user_id,kind,party_id,payload)
   VALUES(NEW.target_id,'complaint_response_needed',NEW.party_id,
    jsonb_build_object('complaint_id',NEW.id,'response_due_at',NEW.response_due_at));
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.native_push_lifecycle_notices() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS native_join_notice ON public.joins;
CREATE TRIGGER native_join_notice AFTER INSERT ON public.joins FOR EACH ROW EXECUTE FUNCTION public.native_push_lifecycle_notices();
DROP TRIGGER IF EXISTS native_complaint_notice ON public.complaints;
CREATE TRIGGER native_complaint_notice AFTER INSERT ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.native_push_lifecycle_notices();

-- Serialize scheduled notice generation; recipient reservations and notices commit together.
-- Existing duplicate reminder notices must be investigated before applying this unique index.
CREATE UNIQUE INDEX IF NOT EXISTS native_notice_reminder_unique ON public.notifications(user_id,party_id,kind)
 WHERE kind IN ('reminder_1h','attendance_confirm');
CREATE OR REPLACE FUNCTION public.produce_native_push_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE made integer:=0; cnt integer;
BEGIN
 IF NOT pg_try_advisory_xact_lock(770012) THEN RETURN 0; END IF;
 WITH recipients AS (
  SELECT p.id,p.host_user_id AS uid,p.place,p.start_at,p.expires_at FROM public.parties p WHERE p.status='open'
   AND ((p.start_at>now() AND p.start_at<=now()+interval '1 hour') OR (p.expires_at<=now() AND p.expires_at>now()-interval '24 hours'))
  UNION SELECT p.id,j.user_id,p.place,p.start_at,p.expires_at FROM public.parties p JOIN public.joins j ON j.party_id=p.id WHERE p.status='open'
   AND ((p.start_at>now() AND p.start_at<=now()+interval '1 hour') OR (p.expires_at<=now() AND p.expires_at>now()-interval '24 hours'))
 ), planned AS (
  SELECT *,CASE WHEN start_at>now() THEN 'reminder_1h' ELSE 'attendance_confirm' END AS k FROM recipients
 ), inserted AS (
  INSERT INTO public.notifications(user_id,kind,party_id,payload)
  SELECT uid,k,id,jsonb_build_object('party_place',place,'start_at',start_at,'closes_at',expires_at+interval '24 hours')
  FROM planned p WHERE NOT EXISTS(SELECT 1 FROM public.notifications n WHERE n.user_id=p.uid AND n.party_id=p.id AND n.kind=p.k)
  ORDER BY start_at LIMIT 500 ON CONFLICT DO NOTHING RETURNING party_id,user_id,kind
 ) INSERT INTO public.party_reminders(party_id,user_id,kind) SELECT party_id,user_id,kind FROM inserted ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS cnt=ROW_COUNT;made:=made+cnt;RETURN made;
END $$;
REVOKE ALL ON FUNCTION public.produce_native_push_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.produce_native_push_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_native_push(p_limit integer DEFAULT 16)
RETURNS SETOF public.native_push_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 UPDATE public.native_push_outbox SET status='dead',finished_at=now(),last_error='expired-or-exhausted'
 WHERE status IN ('pending','processing') AND (expires_at<=now() OR (attempts>=8 AND (lease_until IS NULL OR lease_until<now())));
 RETURN QUERY WITH picked AS (
  SELECT id FROM public.native_push_outbox WHERE expires_at>now() AND attempts<8 AND available_at<=now()
   AND (status='pending' OR (status='processing' AND lease_until<now())) ORDER BY available_at,id
   FOR UPDATE SKIP LOCKED LIMIT GREATEST(1,LEAST(p_limit,32))
 ) UPDATE public.native_push_outbox q SET status='processing',attempts=q.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes'
 FROM picked WHERE q.id=picked.id RETURNING q.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_native_push(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_native_push(integer) TO service_role;
COMMIT;

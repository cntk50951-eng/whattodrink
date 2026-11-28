-- UR E.33：舉報審核結果推送給舉報人（Android；iOS DEF-20261127／AOS DEF-20261127-034）。
-- USER executes in Dashboard; never executed automatically by the app. Additive, replayable. 依賴 0077。
-- 只重建 0077 的入隊函數，兩處改動：清單加 report_resolved、payload 帶 report_id。觸發器沿用，不回填舊事件。
-- 只在 INSERT 時入隊：之後改判是改寫原通知（reportStp），不會再推一次。
BEGIN;
CREATE OR REPLACE FUNCTION public.enqueue_native_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k text; actor uuid; recipient uuid; deadline timestamptz; fields jsonb; m record;
BEGIN
 IF TG_TABLE_NAME='notifications' THEN
  k:=NEW.kind;
  IF k NOT IN ('member_joined','party_cancelled','member_left','member_left_late','reminder_1h',
    'attendance_confirm','complaint_filed','complaint_response_needed','complaint_ack','complaint_result',
    'trust_changed','game_join_request','game_join_result','game_kicked',
    'report_resolved') THEN RETURN NEW; END IF;
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
    'room_id',NEW.payload->>'room_id','code',NEW.payload->>'room_code','decision',NEW.payload->>'decision',
    'report_id',NEW.payload->>'report_id'));
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
COMMIT;

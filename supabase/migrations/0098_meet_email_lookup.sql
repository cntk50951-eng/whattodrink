-- UR I.4：遇見用完整電郵找人（本人開啟「允許用電郵找到我」才會被找到；好友也一樣）。
-- USER executes in Dashboard; never executed automatically by the app. Additive, replayable.
BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_discoverable boolean NOT NULL DEFAULT false;

-- 電郵查詢次數的上限記在只有服務端能寫的表（users 行本人可直接 UPDATE，不能拿它當上限）。
CREATE TABLE IF NOT EXISTS public.meet_email_lookups (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.meet_email_lookups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meet_email_lookups FROM anon, authenticated;
GRANT ALL ON public.meet_email_lookups TO service_role;

-- 原子地「扣一次＋查」：超過上限回 allowed=false 且不查；查不到與對方沒開啟回同一個結果。
CREATE OR REPLACE FUNCTION public.meet_lookup_by_email(p_searcher uuid, p_email text, p_day date, p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer; target uuid;
BEGIN
  INSERT INTO public.meet_email_lookups AS l (user_id, day, used) VALUES (p_searcher, p_day, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET used = l.used + 1 WHERE l.used < p_limit
  RETURNING l.used INTO n;
  IF n IS NULL THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;
  SELECT u.id INTO target
    FROM auth.users a JOIN public.users u ON u.id = a.id
   WHERE lower(a.email) = lower(p_email) AND u.email_discoverable AND u.id <> p_searcher
   LIMIT 1;
  RETURN jsonb_build_object('allowed', true, 'user_id', target);
END $$;
REVOKE ALL ON FUNCTION public.meet_lookup_by_email(uuid, text, date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meet_lookup_by_email(uuid, text, date, integer) TO service_role;

COMMIT;

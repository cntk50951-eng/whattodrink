-- 發佈照片貼文獎勵 Ivy 聊天積分（接 0073）：每則 +1、每日最多 3 則計入；沿用 7 天過期與餘額上限。
-- 冪等：同一則貼文（ref＝checkin id）只入一次。常量由 lib/barCredits.ts 傳入。可重放。
-- Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。

ALTER TABLE bar_credit_lots DROP CONSTRAINT IF EXISTS bar_credit_lots_source_check;
ALTER TABLE bar_credit_lots ADD CONSTRAINT bar_credit_lots_source_check CHECK (source IN ('dice_win', 'post'));
ALTER TABLE bar_credit_events DROP CONSTRAINT IF EXISTS bar_credit_events_kind_check;
ALTER TABLE bar_credit_events ADD CONSTRAINT bar_credit_events_kind_check CHECK (kind IN ('chat', 'dice_loss', 'dice_win', 'refund', 'post'));

CREATE OR REPLACE FUNCTION bar_credit_grant_post(
  p_user uuid, p_n int, p_post uuid, p_lot_days int, p_posts_cap int, p_balance_cap int, p_daily_limit int,
  p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w bar_credit_wallets;
  live_total int;
  posts_today int;
  grant_n int;
BEGIN
  IF p_n <= 0 THEN RAISE EXCEPTION 'bad args'; END IF;
  IF EXISTS (SELECT 1 FROM bar_credit_events WHERE user_id = p_user AND kind = 'post' AND ref = p_post::text) THEN
    RETURN jsonb_build_object('granted', 0, 'reason', 'duplicate', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  w := bar_credit_wallet_lock(p_user, p_now);   -- 鎖錢包行：同一用戶並發發帖串行，日上限不會被繞過
  SELECT count(*) INTO posts_today FROM bar_credit_events
    WHERE user_id = p_user AND kind = 'post' AND bar_hk_day(created_at) = w.day;
  IF posts_today >= p_posts_cap THEN
    RETURN jsonb_build_object('granted', 0, 'reason', 'daily_cap', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  SELECT coalesce(sum(remaining), 0) INTO live_total FROM bar_credit_lots WHERE user_id = p_user AND remaining > 0 AND expires_at > p_now;
  grant_n := least(p_n, p_balance_cap - live_total);
  IF grant_n <= 0 THEN
    RETURN jsonb_build_object('granted', 0, 'reason', 'balance_cap', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  INSERT INTO bar_credit_lots (user_id, amount, remaining, source, match_id, created_at, expires_at)
    VALUES (p_user, grant_n, grant_n, 'post', p_post, p_now, p_now + make_interval(days => p_lot_days));
  INSERT INTO bar_credit_events (user_id, kind, delta, ref, created_at) VALUES (p_user, 'post', grant_n, p_post::text, p_now);
  RETURN jsonb_build_object('granted', grant_n, 'reason', 'ok', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
END $$;

REVOKE ALL ON FUNCTION bar_credit_grant_post(uuid, int, uuid, int, int, int, int, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bar_credit_grant_post(uuid, int, uuid, int, int, int, int, timestamptz) TO service_role;

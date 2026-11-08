-- Bar 聊天額度改版（接 0073／0074）：取消「每日免費」，改成每個登入帳號一次性起始積分（不過期、不重置）；
-- 之後靠玩大話骰（贏）和發照片貼文賺積分（各批 7 天過期）。起始積分用 source='starter'，過期日設 2099-12-31（花的時候排在最後）。
-- 起始積分不佔「餘額上限」（lib/barCredits.ts 的 balanceCap 只算賺來的），否則持有 50 就永遠賺不到。
-- 冪等：同一帳號只發一次（events 的 UNIQUE(user, kind, ref) 擋住並發）。常量（起始量／每日 0）由 lib/barCredits.ts 傳入。可重放。
-- Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。須在 0074 之後跑。

ALTER TABLE bar_credit_lots DROP CONSTRAINT IF EXISTS bar_credit_lots_source_check;
ALTER TABLE bar_credit_lots ADD CONSTRAINT bar_credit_lots_source_check CHECK (source IN ('dice_win', 'post', 'starter'));
ALTER TABLE bar_credit_events DROP CONSTRAINT IF EXISTS bar_credit_events_kind_check;
ALTER TABLE bar_credit_events ADD CONSTRAINT bar_credit_events_kind_check CHECK (kind IN ('chat', 'dice_loss', 'dice_win', 'refund', 'post', 'starter'));

-- 狀態：每批多回 source（客戶端據此把起始積分顯示成「不過期」）
CREATE OR REPLACE FUNCTION bar_credit_state(p_user uuid, p_daily_limit int, p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w bar_credit_wallets;
  today date := bar_hk_day(p_now);
  used int := 0;
  wins int := 0;
  lots jsonb;
  lot_total int;
BEGIN
  SELECT * INTO w FROM bar_credit_wallets WHERE user_id = p_user;
  IF FOUND AND w.day = today THEN used := w.daily_used; wins := w.wins_today; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'amount', amount, 'remaining', remaining, 'expires_at', expires_at, 'source', source) ORDER BY expires_at, created_at), '[]'::jsonb),
         coalesce(sum(remaining), 0)
    INTO lots, lot_total
    FROM bar_credit_lots WHERE user_id = p_user AND remaining > 0 AND expires_at > p_now;
  RETURN jsonb_build_object(
    'daily', jsonb_build_object('limit', p_daily_limit, 'used', used, 'remaining', greatest(p_daily_limit - used, 0)),
    'lots', lots,
    'earned_total', lot_total,
    'total', greatest(p_daily_limit - used, 0) + lot_total,
    'wins_today', wins,
    'next_reset_at', ((today + 1)::timestamp AT TIME ZONE 'Asia/Hong_Kong')
  );
END $$;

-- 發起始積分（每帳號一次）。回傳 true＝這次真的發了
CREATE OR REPLACE FUNCTION bar_credit_ensure_starter(p_user uuid, p_n int, p_now timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_n <= 0 THEN RETURN false; END IF;
  INSERT INTO bar_credit_events (user_id, kind, delta, ref, created_at) VALUES (p_user, 'starter', p_n, 'starter', p_now)
    ON CONFLICT (user_id, kind, ref) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO bar_credit_lots (user_id, amount, remaining, source, created_at, expires_at)
    VALUES (p_user, p_n, p_n, 'starter', p_now, '2099-12-31T00:00:00Z');
  RETURN true;
END $$;

-- 贏局入帳：餘額上限只算賺來的（不含起始積分）
CREATE OR REPLACE FUNCTION bar_credit_grant(
  p_user uuid, p_n int, p_match uuid, p_lot_days int, p_wins_cap int, p_balance_cap int, p_daily_limit int,
  p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w bar_credit_wallets;
  live_total int;
  grant_n int;
BEGIN
  IF p_n <= 0 THEN RAISE EXCEPTION 'bad args'; END IF;
  IF EXISTS (SELECT 1 FROM bar_credit_events WHERE user_id = p_user AND kind = 'dice_win' AND ref = p_match::text) THEN
    RETURN jsonb_build_object('granted', 0, 'reason', 'duplicate', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  w := bar_credit_wallet_lock(p_user, p_now);
  IF w.wins_today >= p_wins_cap THEN
    RETURN jsonb_build_object('granted', 0, 'reason', 'daily_cap', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  SELECT coalesce(sum(remaining), 0) INTO live_total FROM bar_credit_lots
    WHERE user_id = p_user AND remaining > 0 AND expires_at > p_now AND source <> 'starter';
  grant_n := least(p_n, p_balance_cap - live_total);
  IF grant_n <= 0 THEN
    RETURN jsonb_build_object('granted', 0, 'reason', 'balance_cap', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  INSERT INTO bar_credit_lots (user_id, amount, remaining, source, match_id, created_at, expires_at)
    VALUES (p_user, grant_n, grant_n, 'dice_win', p_match, p_now, p_now + make_interval(days => p_lot_days));
  UPDATE bar_credit_wallets SET wins_today = wins_today + 1, updated_at = p_now WHERE user_id = p_user;
  INSERT INTO bar_credit_events (user_id, kind, delta, ref, created_at) VALUES (p_user, 'dice_win', grant_n, p_match::text, p_now);
  RETURN jsonb_build_object('granted', grant_n, 'reason', CASE WHEN grant_n < p_n THEN 'balance_cap_partial' ELSE 'ok' END,
                            'credits', bar_credit_state(p_user, p_daily_limit, p_now));
END $$;

-- 發帖入帳：同上，餘額上限不含起始積分
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
  w := bar_credit_wallet_lock(p_user, p_now);
  SELECT count(*) INTO posts_today FROM bar_credit_events
    WHERE user_id = p_user AND kind = 'post' AND bar_hk_day(created_at) = w.day;
  IF posts_today >= p_posts_cap THEN
    RETURN jsonb_build_object('granted', 0, 'reason', 'daily_cap', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  SELECT coalesce(sum(remaining), 0) INTO live_total FROM bar_credit_lots
    WHERE user_id = p_user AND remaining > 0 AND expires_at > p_now AND source <> 'starter';
  grant_n := least(p_n, p_balance_cap - live_total);
  IF grant_n <= 0 THEN
    RETURN jsonb_build_object('granted', 0, 'reason', 'balance_cap', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  INSERT INTO bar_credit_lots (user_id, amount, remaining, source, match_id, created_at, expires_at)
    VALUES (p_user, grant_n, grant_n, 'post', p_post, p_now, p_now + make_interval(days => p_lot_days));
  INSERT INTO bar_credit_events (user_id, kind, delta, ref, created_at) VALUES (p_user, 'post', grant_n, p_post::text, p_now);
  RETURN jsonb_build_object('granted', grant_n, 'reason', 'ok', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
END $$;

REVOKE ALL ON FUNCTION bar_credit_ensure_starter(uuid, int, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bar_credit_ensure_starter(uuid, int, timestamptz) TO service_role;

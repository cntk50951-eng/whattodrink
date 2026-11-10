-- Bar 21點（用戶 vs Ivy）：對局表＋積分擴充。接 0073／0074／0075，**須在三者之後跑**（CHECK 清單已含 0074 的 post、0075 的 starter）。
-- 設計：whattodrink_ios/docs/plans/bar-blackjack-design.md。可重放（IF NOT EXISTS／OR REPLACE／DROP IF EXISTS）。
-- Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。**未批准前不要跑。**

-- 1) 積分來源／流水類型擴充（保留 post、starter）
ALTER TABLE bar_credit_lots DROP CONSTRAINT IF EXISTS bar_credit_lots_source_check;
ALTER TABLE bar_credit_lots ADD CONSTRAINT bar_credit_lots_source_check CHECK (source IN ('dice_win', 'post', 'starter', 'blackjack_win'));
ALTER TABLE bar_credit_events DROP CONSTRAINT IF EXISTS bar_credit_events_kind_check;
ALTER TABLE bar_credit_events ADD CONSTRAINT bar_credit_events_kind_check
  CHECK (kind IN ('chat', 'dice_loss', 'dice_win', 'refund', 'post', 'starter', 'blackjack_win', 'blackjack_loss'));

-- 2) 21點對局（服務端持有整副牌與暗牌；客戶端只經 API 拿視圖）。RLS 開、不建 policy，只經 service_role。
CREATE TABLE IF NOT EXISTS bar_blackjack_matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      text NOT NULL CHECK (status IN ('active', 'won', 'lost', 'push', 'abandoned')),
  state       jsonb NOT NULL,
  credits     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  settled_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS bar_blackjack_one_active ON bar_blackjack_matches (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS bar_blackjack_user_day ON bar_blackjack_matches (user_id, created_at);
ALTER TABLE bar_blackjack_matches ENABLE ROW LEVEL SECURITY;

-- 3) 扣次：放行 blackjack_loss（其餘與 0073 完全相同）
CREATE OR REPLACE FUNCTION bar_credit_spend(
  p_user uuid, p_n int, p_kind text, p_ref text, p_daily_limit int, p_allow_partial boolean,
  p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w bar_credit_wallets;
  need int := p_n;
  avail_daily int;
  live_total int;
  from_daily int := 0;
  parts jsonb := '[]'::jsonb;
  rec record;
  take int;
  spent int;
BEGIN
  IF p_n <= 0 OR p_kind NOT IN ('chat', 'dice_loss', 'blackjack_loss') THEN RAISE EXCEPTION 'bad args'; END IF;
  IF p_ref IS NOT NULL AND EXISTS (SELECT 1 FROM bar_credit_events WHERE user_id = p_user AND kind = p_kind AND ref = p_ref) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  w := bar_credit_wallet_lock(p_user, p_now);
  avail_daily := greatest(p_daily_limit - w.daily_used, 0);
  SELECT coalesce(sum(remaining), 0) INTO live_total FROM bar_credit_lots WHERE user_id = p_user AND remaining > 0 AND expires_at > p_now;
  IF NOT p_allow_partial AND avail_daily + live_total < p_n THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exhausted', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  from_daily := least(need, avail_daily);
  need := need - from_daily;
  FOR rec IN SELECT id, remaining FROM bar_credit_lots
             WHERE user_id = p_user AND remaining > 0 AND expires_at > p_now
             ORDER BY expires_at, created_at FOR UPDATE LOOP
    EXIT WHEN need <= 0;
    take := least(rec.remaining, need);
    UPDATE bar_credit_lots SET remaining = remaining - take WHERE id = rec.id;
    parts := parts || jsonb_build_object('lot_id', rec.id, 'n', take);
    need := need - take;
  END LOOP;
  spent := p_n - need;
  UPDATE bar_credit_wallets SET daily_used = daily_used + from_daily, updated_at = p_now WHERE user_id = p_user;
  INSERT INTO bar_credit_events (user_id, kind, delta, daily_part, lot_parts, ref, created_at)
    VALUES (p_user, p_kind, -spent, from_daily, parts, p_ref, p_now);
  RETURN jsonb_build_object('ok', true, 'spent', spent, 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
END $$;

-- 4) 贏局入帳（兩個遊戲共用）：p_kind＝'dice_win'｜'blackjack_win'；今日贏局計數 wins_today 兩個遊戲共用同一個。
--    與 0075 的 bar_credit_grant 相同，只是把寫死的 'dice_win' 參數化；餘額上限不含起始積分。
CREATE OR REPLACE FUNCTION bar_credit_grant_win(
  p_user uuid, p_n int, p_match uuid, p_kind text, p_lot_days int, p_wins_cap int, p_balance_cap int, p_daily_limit int,
  p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w bar_credit_wallets;
  live_total int;
  grant_n int;
BEGIN
  IF p_n <= 0 OR p_kind NOT IN ('dice_win', 'blackjack_win') THEN RAISE EXCEPTION 'bad args'; END IF;
  IF EXISTS (SELECT 1 FROM bar_credit_events WHERE user_id = p_user AND kind = p_kind AND ref = p_match::text) THEN
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
    VALUES (p_user, grant_n, grant_n, p_kind, p_match, p_now, p_now + make_interval(days => p_lot_days));
  UPDATE bar_credit_wallets SET wins_today = wins_today + 1, updated_at = p_now WHERE user_id = p_user;
  INSERT INTO bar_credit_events (user_id, kind, delta, ref, created_at) VALUES (p_user, p_kind, grant_n, p_match::text, p_now);
  RETURN jsonb_build_object('granted', grant_n, 'reason', CASE WHEN grant_n < p_n THEN 'balance_cap_partial' ELSE 'ok' END,
                            'credits', bar_credit_state(p_user, p_daily_limit, p_now));
END $$;

-- 5) 輸局扣次（兩個遊戲共用）：今日贏局已達上限就不扣（用戶 2026-11-09 定案）。
--    鎖錢包行並做香港日期惰性重置後才讀 wins_today，所以「昨天的舊計數」不會讓今天永遠不扣；整個判斷在同一交易內，無競態。
--    不扣時也寫一筆 delta=0 的流水，保證冪等（同一局重複結算不會又扣）。
CREATE OR REPLACE FUNCTION bar_credit_game_loss(
  p_user uuid, p_kind text, p_ref text, p_wins_cap int, p_daily_limit int,
  p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w bar_credit_wallets;
BEGIN
  IF p_kind NOT IN ('dice_loss', 'blackjack_loss') THEN RAISE EXCEPTION 'bad args'; END IF;
  IF EXISTS (SELECT 1 FROM bar_credit_events WHERE user_id = p_user AND kind = p_kind AND ref = p_ref) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'spent', 0, 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  w := bar_credit_wallet_lock(p_user, p_now);
  IF w.wins_today >= p_wins_cap THEN
    INSERT INTO bar_credit_events (user_id, kind, delta, ref, created_at) VALUES (p_user, p_kind, 0, p_ref, p_now)
      ON CONFLICT (user_id, kind, ref) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'spent', 0, 'reason', 'win_cap', 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  RETURN bar_credit_spend(p_user, 1, p_kind, p_ref, p_daily_limit, true, p_now);
END $$;

REVOKE ALL ON FUNCTION bar_credit_grant_win(uuid, int, uuid, text, int, int, int, int, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION bar_credit_game_loss(uuid, text, text, int, int, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bar_credit_grant_win(uuid, int, uuid, text, int, int, int, int, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION bar_credit_game_loss(uuid, text, text, int, int, timestamptz) TO service_role;

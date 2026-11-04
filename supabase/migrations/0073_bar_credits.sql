-- Bar 聊天積分（Credits）：每日免費次數＋大話骰贏來的積分批次（各批 7 天過期）。
-- 目的：AI 聊天按 token 計費，額度必須在服務端算（見 whattodrink_ios docs/plans/bar-dice-credits-design.md）。
-- 全部表開 RLS 且不建 policy：anon／authenticated 讀寫都被拒，只有 service_role（API 路由）能碰；
-- 函數 SECURITY DEFINER、只授權給 service_role。時間一律用服務端 now()（`p_now` 只給測試注入）。
-- 可重放：IF NOT EXISTS／CREATE OR REPLACE。Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。
-- 「一天」＝香港日期（和遇見搜尋額度同口徑）。常量（15／+3／7 天／5 局／45 餘額）由 lib/barCredits.ts 傳入，不寫死在 SQL。

CREATE TABLE IF NOT EXISTS bar_credit_wallets (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  day         date NOT NULL,                          -- 香港日期；和今天不同＝惰性重置 daily_used／wins_today
  daily_used  int  NOT NULL DEFAULT 0 CHECK (daily_used >= 0),
  wins_today  int  NOT NULL DEFAULT 0 CHECK (wins_today >= 0),  -- 今天已計入積分的勝局數（賺取上限用）
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bar_credit_lots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      int  NOT NULL CHECK (amount > 0),
  remaining   int  NOT NULL CHECK (remaining >= 0 AND remaining <= amount),
  source      text NOT NULL CHECK (source IN ('dice_win')),
  match_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS bar_credit_lots_live_idx ON bar_credit_lots (user_id, expires_at) WHERE remaining > 0;

CREATE TABLE IF NOT EXISTS bar_credit_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('chat', 'dice_loss', 'dice_win', 'refund')),
  delta       int  NOT NULL,                          -- 扣為負、加為正
  daily_part  int  NOT NULL DEFAULT 0,                -- 這次從今日免費額度扣了多少
  lot_parts   jsonb NOT NULL DEFAULT '[]'::jsonb,     -- [{lot_id, n}]：從哪些批次扣了多少
  ref         text,                                   -- chat 的 request_id／dice 的 match_id（冪等）
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS bar_credit_events_user_idx ON bar_credit_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bar_dice_matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      text NOT NULL CHECK (status IN ('active', 'won', 'lost', 'abandoned')),
  state       jsonb NOT NULL,                         -- 服務端持有所有骰子；客戶端只拿到自己的
  credits     jsonb,                                  -- 結算結果 {delta, granted, reason}
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  settled_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS bar_dice_one_active ON bar_dice_matches (user_id) WHERE status = 'active';

ALTER TABLE bar_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_credit_lots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_credit_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_dice_matches   ENABLE ROW LEVEL SECURITY;

-- ───────────────────────── 函數 ─────────────────────────

CREATE OR REPLACE FUNCTION bar_hk_day(p_now timestamptz) RETURNS date
LANGUAGE sql IMMUTABLE AS $$ SELECT (p_now AT TIME ZONE 'Asia/Hong_Kong')::date $$;

-- 唯讀狀態：惰性重置（只在回傳值裡體現，不寫庫）；過期批次直接忽略
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
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'amount', amount, 'remaining', remaining, 'expires_at', expires_at) ORDER BY expires_at, created_at), '[]'::jsonb),
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

-- 內部：鎖住錢包行並做日期重置，回傳最新的行
CREATE OR REPLACE FUNCTION bar_credit_wallet_lock(p_user uuid, p_now timestamptz)
RETURNS bar_credit_wallets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w bar_credit_wallets;
  today date := bar_hk_day(p_now);
BEGIN
  INSERT INTO bar_credit_wallets (user_id, day) VALUES (p_user, today) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM bar_credit_wallets WHERE user_id = p_user FOR UPDATE;
  IF w.day <> today THEN
    UPDATE bar_credit_wallets SET day = today, daily_used = 0, wins_today = 0, updated_at = p_now WHERE user_id = p_user RETURNING * INTO w;
  END IF;
  RETURN w;
END $$;

-- 扣次：先今日免費，再扣「最快過期」的批次。p_allow_partial=false（聊天）不夠整筆不扣；true（輸局）扣到 0 為止。
-- 冪等：同 (user, kind, ref) 已扣過就直接回 duplicate，不重複扣。
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
  IF p_n <= 0 OR p_kind NOT IN ('chat', 'dice_loss') THEN RAISE EXCEPTION 'bad args'; END IF;
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

-- 退款（Ivy 回覆失敗時）：按流水原樣退回，冪等；批次已過期就不退；跨日了免費額度已重置就不退
CREATE OR REPLACE FUNCTION bar_credit_refund(p_user uuid, p_ref text, p_daily_limit int, p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w bar_credit_wallets;
  ev bar_credit_events;
  part jsonb;
BEGIN
  SELECT * INTO ev FROM bar_credit_events WHERE user_id = p_user AND kind = 'chat' AND ref = p_ref;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'refunded', 0, 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
  END IF;
  w := bar_credit_wallet_lock(p_user, p_now);
  IF ev.daily_part > 0 AND bar_hk_day(ev.created_at) = w.day THEN
    UPDATE bar_credit_wallets SET daily_used = greatest(daily_used - ev.daily_part, 0), updated_at = p_now WHERE user_id = p_user;
  END IF;
  FOR part IN SELECT * FROM jsonb_array_elements(ev.lot_parts) LOOP
    UPDATE bar_credit_lots SET remaining = least(amount, remaining + (part->>'n')::int)
      WHERE id = (part->>'lot_id')::uuid AND expires_at > p_now;
  END LOOP;
  DELETE FROM bar_credit_events WHERE id = ev.id;     -- 刪掉原扣次流水：同一 request_id 重試可以再扣
  INSERT INTO bar_credit_events (user_id, kind, delta, daily_part, lot_parts, ref, created_at)
    VALUES (p_user, 'refund', -ev.delta, ev.daily_part, ev.lot_parts, p_ref, p_now)
    ON CONFLICT (user_id, kind, ref) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'refunded', -ev.delta, 'credits', bar_credit_state(p_user, p_daily_limit, p_now));
END $$;

-- 贏局入帳：今日最多 p_wins_cap 局計入、餘額最多 p_balance_cap；冪等（同一局只入一次）
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
  SELECT coalesce(sum(remaining), 0) INTO live_total FROM bar_credit_lots WHERE user_id = p_user AND remaining > 0 AND expires_at > p_now;
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

REVOKE ALL ON FUNCTION bar_credit_state(uuid, int, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION bar_credit_wallet_lock(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION bar_credit_spend(uuid, int, text, text, int, boolean, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION bar_credit_refund(uuid, text, int, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION bar_credit_grant(uuid, int, uuid, int, int, int, int, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bar_credit_state(uuid, int, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION bar_credit_spend(uuid, int, text, text, int, boolean, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION bar_credit_refund(uuid, text, int, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION bar_credit_grant(uuid, int, uuid, int, int, int, int, timestamptz) TO service_role;

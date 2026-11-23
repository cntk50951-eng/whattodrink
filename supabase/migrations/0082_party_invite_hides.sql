-- 已過期／已結束約局與私約邀請的單邊刪除（只隱藏自己的列表紀錄，不影響對方、誠信台帳、投訴與每日額度）。
-- 可重放：所有語句均帶 IF NOT EXISTS / DROP IF EXISTS。
-- Supabase Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。

-- 1. 私約邀請表新增發起方／接收方各自的單邊隱藏時間戳
ALTER TABLE drink_invites
  ADD COLUMN IF NOT EXISTS hidden_by_from_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS hidden_by_to_at timestamptz NULL;

-- 2. 公開酒局單邊隱藏表（只影響「我的約局」box=mine 列表，不刪除主表紀錄）
CREATE TABLE IF NOT EXISTS party_hides (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES parties (id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, party_id)
);

CREATE INDEX IF NOT EXISTS party_hides_party_idx
  ON party_hides (party_id);

ALTER TABLE party_hides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "party_hides self read" ON party_hides;
CREATE POLICY "party_hides self read"
  ON party_hides FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "party_hides self insert" ON party_hides;
CREATE POLICY "party_hides self insert"
  ON party_hides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

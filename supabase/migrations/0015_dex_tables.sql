-- UR G1.0 扭蛋＋圖鑑：數據與契約（表＋RLS 全拒，Route Handler service-role 直寫，G1.4 實現）。
-- Dashboard 貼上執行（可重放：IF NOT EXISTS＋ADD COLUMN 守衛；UNIQUE 衝突靠 handler 重試）。
-- 匿名身份：客戶端 localStorage 自造 anon UUID，首次收錄時服務端建 dex_identities 行並發 dex_code；
-- 登錄認領＝把 a: 行改寫 u:（主鍵去重天然保證）。保底計數器只留本地（被刷只影響自己）。

CREATE TABLE IF NOT EXISTS dex_identities (
  anon_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dex_code text NOT NULL UNIQUE DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- dex_code 10 hex（1T 空間；萬一撞 UNIQUE 由 handler 重試，非遷移問題）；
-- code 不可反推 anon_id，公開頁只認 code（G1_GACHA_DEX_PLAN §3.4）。

CREATE TABLE IF NOT EXISTS user_cards (
  ident text NOT NULL,
  card_id text NOT NULL,
  obtained_at timestamptz NOT NULL DEFAULT now(),
  dup_count int NOT NULL DEFAULT 1 CHECK (dup_count >= 1),
  PRIMARY KEY (ident, card_id)
);
-- ident = 'u:<uuid>'（登錄）或 'a:<uuid>'（匿名）；唯一鍵天然去重。
-- card_id 不設 FK：目錄由代碼驅動（lib/beers.ts＋icon 文件），白名單在 Route Handler 校驗（G1.4）；
-- dup_count 節流同步（本地累加重複，隨下次收錄／會話結束批量刷庫，見方案 §3.4）。
CREATE INDEX IF NOT EXISTS user_cards_ident_idx ON user_cards (ident);

CREATE TABLE IF NOT EXISTS dex_likes (
  dex_code text NOT NULL REFERENCES dex_identities (dex_code) ON DELETE CASCADE,
  anon_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dex_code, anon_id)
);
-- 讚：one-tap＋匿名去重；anon_id 無 FK（訪客未必有 identities 行，純聲稱＋限流，風險已接受，見方案 §3.4）。
CREATE INDEX IF NOT EXISTS dex_likes_code_idx ON dex_likes (dex_code);

-- 全拒：任何 key（連 anon）都直讀寫不了（沿 0001 全拒口徑）；
-- 讀寫一律走 Route Handler（service role，G1.4 建 service client；key 見 .env.example:36）。
ALTER TABLE dex_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dex_likes ENABLE ROW LEVEL SECURITY;

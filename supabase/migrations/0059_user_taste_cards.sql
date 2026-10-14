-- 0059 AI 口味卡（主頁「我的口味」下的 AI 分析）：每個用戶一份緩存。
-- 僅服務端讀寫（RLS 開啟、無策略）；visible＝用戶是否對他人公開（默認公開）；
-- refreshes＝最近手動重新生成的時間戳（限每天 3 次）；inputs_hash＝生成時輸入的指紋（沒變就不重算）。
CREATE TABLE IF NOT EXISTS user_taste_cards (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  inputs_hash text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  visible boolean NOT NULL DEFAULT true,
  refreshes jsonb NOT NULL DEFAULT '[]'
);
ALTER TABLE user_taste_cards ENABLE ROW LEVEL SECURITY;

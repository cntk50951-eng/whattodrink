-- 0058 酒保記憶（Ivy 認得你）：每個用戶一份摘要文檔（只存摘要，不留原始對話）。
-- 僅服務端讀寫（RLS 開啟、無策略）；帳號刪除級聯刪除。rev 用於跨設備樂觀鎖。
CREATE TABLE IF NOT EXISTS bar_memories (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  doc jsonb NOT NULL,
  rev integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bar_memories ENABLE ROW LEVEL SECURITY;

-- EPIC D 聊天（UR D.1）：conversations＋members＋messages，可重放。
-- 首期 1v1＋群預留／90 天自動過期／陌生人整表不可見（行級，沿 checkins 口徑）。
-- Dashboard SQL Editor 貼上執行（DROP IF EXISTS＋CREATE／IF NOT EXISTS 全套）。
-- 寫入分工：建會話走 service_role（route 先驗 accepted 互好友，見 D.2）；
-- 讀＋發消息走 user JWT＋下述 RLS；隱身攔截在應用層（沿 live 三刀口徑）。

-- 0. 消息類型枚舉（加類只 ALTER TYPE ADD VALUE，不改表不遷移）
DO $$ BEGIN
  CREATE TYPE message_kind AS ENUM ('text', 'image', 'audio');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. 會話（direct 首期；group 預留：type 切換＋owner 列以後加，不動既有行）
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  -- 1v1 去重鍵：min(a,b)|max(a,b)（server 算；group 用 NULL 不進唯一索引）
  direct_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 90 天保留：每次寫入由 route 刷新＝末條＋90d；讀時懶刪過期（沿 invites 口徑，不另起 cron）
  expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days'
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_direct_key_uidx
  ON conversations (direct_key) WHERE type = 'direct' AND direct_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_expires_idx ON conversations (expires_at);

-- 2. 成員水位（未讀＝last_read_at 之後對方條數，server 算，不存計數列；
--    muted 免打擾；hidden_at＝用戶刪會話只藏自己，不刪別人）
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  muted boolean NOT NULL DEFAULT false,
  hidden_at timestamptz NULL,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conversation_members_user_idx
  ON conversation_members (user_id);

-- 3. 消息（body 文本類必填；attachments jsonb 給圖片語音以後插：
--    {path, mime, bytes, secs?, width?}，屆時零遷移；client_msg_id 冪等唯一）
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind message_kind NOT NULL DEFAULT 'text',
  body text NULL CHECK (kind <> 'text' OR body IS NOT NULL),
  attachments jsonb NOT NULL DEFAULT '[]',
  client_msg_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, client_msg_id)
);
CREATE INDEX IF NOT EXISTS messages_conv_created_idx
  ON messages (conversation_id, created_at DESC);

-- 4. RLS（deny-by-default；建會話／加成員走 service_role，故 auth 側只開讀＋發消息）
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4a. 會話：只看自己在的（陌生人整行不可見，不是欄位遮罩）
DROP POLICY IF EXISTS "conversations member read" ON conversations;
CREATE POLICY "conversations member read"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members m
      WHERE m.conversation_id = conversations.id AND m.user_id = auth.uid()
    )
  );

-- 4b. 成員水位：只讀寫自己的行（對方暱稱走 users 表 server join，不讀他行）
DROP POLICY IF EXISTS "members self read" ON conversation_members;
CREATE POLICY "members self read"
  ON conversation_members FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "members self write watermark" ON conversation_members;
CREATE POLICY "members self write watermark"
  ON conversation_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4c. 消息：成員可讀；發送限本人＋是成員（陌生人／退會寫不進）
DROP POLICY IF EXISTS "messages member read" ON messages;
CREATE POLICY "messages member read"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members m
      WHERE m.conversation_id = messages.conversation_id AND m.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "messages member send" ON messages;
CREATE POLICY "messages member send"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversation_members m
      WHERE m.conversation_id = messages.conversation_id AND m.user_id = auth.uid()
    )
  );
-- UPDATE／DELETE 不開（撤回／編輯以後另議；刪會話走 members.hidden_at）。

-- 聊天紀錄刪除（單條刪除：僅對我／雙方撤回；整段清空：cleared_before 水位）。
-- 可重放：所有語句均帶 IF NOT EXISTS / DROP IF EXISTS。
-- Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。

-- 1. 成員表新增 cleared_before（刪整個聊天紀錄時寫入；重開或對方發新消息時只顯示此時間之後的消息）
ALTER TABLE conversation_members
  ADD COLUMN IF NOT EXISTS cleared_before timestamptz NULL;

-- 2. 消息表新增 deleted_at（為所有人撤回軟刪；不物理抹除，保留投訴證據與審計完整性）
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- 3. 單邊刪除表（僅對我刪除；對方照常可見）
CREATE TABLE IF NOT EXISTS message_deletions (
  message_id uuid NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS message_deletions_user_idx
  ON message_deletions (user_id);

ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_deletions self read" ON message_deletions;
CREATE POLICY "message_deletions self read"
  ON message_deletions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "message_deletions self insert" ON message_deletions;
CREATE POLICY "message_deletions self insert"
  ON message_deletions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. 更新 get_conversations RPC（返回列與 0020 完全相同，過濾已撤回／已單邊刪除／早於 cleared_before 的消息）
DROP FUNCTION IF EXISTS get_conversations(uuid, int);

CREATE FUNCTION get_conversations(p_uid uuid, p_limit int)
RETURNS TABLE (
  conv_id uuid,
  peer_id uuid,
  nickname text,
  avatar_url text,
  last_id uuid,
  last_sender uuid,
  last_kind text,
  last_body text,
  last_ca timestamptz,
  last_secs int,
  last_checkin_id text,
  last_place text,
  unread bigint,
  muted boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH mine AS (
    SELECT m.conversation_id, m.last_read_at, m.muted, m.hidden_at, m.cleared_before
    FROM conversation_members m
    WHERE m.user_id = p_uid AND m.hidden_at IS NULL
  ),
  last_msg AS (
    SELECT DISTINCT ON (msg.conversation_id)
      msg.conversation_id, msg.id, msg.sender_id, msg.kind, msg.body, msg.created_at,
      (msg.attachments->0->>'secs')::int AS secs,
      (msg.attachments->0->>'checkin_id') AS checkin_id,
      (msg.attachments->0->>'place') AS place
    FROM messages msg
    JOIN mine ON mine.conversation_id = msg.conversation_id
    WHERE msg.deleted_at IS NULL
      AND (mine.cleared_before IS NULL OR msg.created_at > mine.cleared_before)
      AND NOT EXISTS (
        SELECT 1 FROM message_deletions md
        WHERE md.message_id = msg.id AND md.user_id = p_uid
      )
    ORDER BY msg.conversation_id, msg.created_at DESC, msg.id DESC
  )
  SELECT
    c.id, u.id, u.nickname, u.avatar_url,
    lm.id, lm.sender_id,
    lm.kind::text, lm.body, lm.created_at, lm.secs, lm.checkin_id, lm.place,
    (
      SELECT count(*)
      FROM messages um
      WHERE um.conversation_id = c.id
        AND um.sender_id <> p_uid
        AND um.created_at > mine.last_read_at
        AND um.deleted_at IS NULL
        AND (mine.cleared_before IS NULL OR um.created_at > mine.cleared_before)
        AND NOT EXISTS (
          SELECT 1 FROM message_deletions md
          WHERE md.message_id = um.id AND md.user_id = p_uid
        )
    ),
    mine.muted,
    COALESCE(lm.created_at, c.created_at)
  FROM conversations c
  JOIN mine ON mine.conversation_id = c.id
  LEFT JOIN last_msg lm ON lm.conversation_id = c.id
  LEFT JOIN conversation_members pm
    ON pm.conversation_id = c.id AND pm.user_id <> p_uid
  LEFT JOIN users u ON u.id = pm.user_id
  WHERE c.expires_at > now()
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC, c.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION get_conversations(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION get_conversations(uuid, int) TO authenticated;

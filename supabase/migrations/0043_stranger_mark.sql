-- UR D.10 陌生人配额改版（§十四）：累计制（以成为好友为界，对方回复不清零）。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：sent_as_stranger（发送时 !isFriend 写入；解除好友时清，见 DELETE /friends；
--   成为好友时不清——好友免检，标记无用；RLS 无需动：写沿旧 insert policy，读走 service）。
-- 回填：direct 会话里、现在与对方无 accepted 关系的消息置 true。
--  ⚠️ 已知缺陷（§十五.1）：判据是「现在」而非「发送时」，曾是好友、已解除的会话里，
--  当时作为好友发的消息也会被误标。由 0044 统一清除，勿以本段为准。

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_as_stranger boolean NOT NULL DEFAULT false;

UPDATE messages m
SET sent_as_stranger = true
WHERE EXISTS (
  SELECT 1 FROM conversations c WHERE c.id = m.conversation_id AND c.type = 'direct'
)
AND NOT EXISTS (
  SELECT 1
  FROM conversation_members cm
  JOIN friendships f ON f.status = 'accepted' AND (
    (f.user_id = m.sender_id AND f.friend_id = cm.user_id) OR
    (f.friend_id = m.sender_id AND f.user_id = cm.user_id)
  )
  WHERE cm.conversation_id = m.conversation_id AND cm.user_id <> m.sender_id
);

CREATE INDEX IF NOT EXISTS messages_stranger_idx
  ON messages (conversation_id, sender_id) WHERE sent_as_stranger;

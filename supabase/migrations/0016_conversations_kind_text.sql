-- DEF-20261003-003：`messages.kind` 是 `message_kind` ENUM（0012），
-- 0014 声明 `last_kind text` 却直出 enum 值——enum→text 无隐式转换，
-- PG 报 42804 整查询失败，`GET /conversations` 恒 500。
-- 修法：输出侧显式 `lm.kind::text`（其余列已逐一核对无第二处）。
-- 可重放：CREATE OR REPLACE。Dashboard SQL Editor 贴跑，成功回
-- "Success. No rows returned"（函数替换无输出行）。

CREATE OR REPLACE FUNCTION get_conversations(p_uid uuid, p_limit int)
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
    SELECT m.conversation_id, m.last_read_at, m.muted, m.hidden_at
    FROM conversation_members m
    WHERE m.user_id = p_uid AND m.hidden_at IS NULL
  ),
  last_msg AS (
    SELECT DISTINCT ON (msg.conversation_id)
      msg.conversation_id, msg.id, msg.sender_id, msg.kind, msg.body, msg.created_at,
      -- D.6 列表語音章秒數（首附件 secs；圖／文回 NULL，客戶端回通用章）
      (msg.attachments->0->>'secs')::int AS secs
    FROM messages msg
    JOIN mine ON mine.conversation_id = msg.conversation_id
    ORDER BY msg.conversation_id, msg.created_at DESC, msg.id DESC
  )
  SELECT
    c.id, u.id, u.nickname, u.avatar_url,
    lm.id, lm.sender_id,
    -- DEF-20261003-003：enum 必须显式转 text（隐式无此转换，42804）
    lm.kind::text, lm.body, lm.created_at, lm.secs,
    (
      SELECT count(*)
      FROM messages um
      WHERE um.conversation_id = c.id
        AND um.sender_id <> p_uid
        AND um.created_at > mine.last_read_at
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

-- 匿名禁調（authenticated 可調；service_role 天然可調）——0014 原样保留
REVOKE ALL ON FUNCTION get_conversations(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION get_conversations(uuid, int) TO authenticated;

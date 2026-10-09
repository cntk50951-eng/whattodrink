-- UR D.6＋列表提速：會話列表單 RPC（N+1 收斂到 1 roundtrip）。
-- `SECURITY DEFINER`＋首行 `auth.uid() = p_uid` 硬校驗（對不上直接拋，不回空，fail-closed）；
-- 匿名／非本人調用即錯；表 RLS 不動。Dashboard 貼上執行（可重放：先卸後掛；
-- OR REPLACE 改不了返回類型，舊函數在庫即 42P13，故先 DROP）。
-- 畢業線：上量後把未讀計數列物化，本函數簽名不變（route 零改）。

DROP FUNCTION IF EXISTS get_conversations(uuid, int);

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
    -- DEF-20261003-003 回归合并（0016 同款）：enum 必须显式转 text；
    -- 此前 0014 无此 cast，重贴即覆盖掉 0016 的修复致 42804 复发，故合入本文件为唯一真相。
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

-- 匿名禁調（authenticated 可調；service_role 天然可調）
REVOKE ALL ON FUNCTION get_conversations(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION get_conversations(uuid, int) TO authenticated;

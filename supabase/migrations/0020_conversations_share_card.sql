-- UR E.13 站内分享：列表末条透出分享打卡 id（卡片行渲染用）。
-- 可重放：先 DROP 再 CREATE（PG 禁止 OR REPLACE 改返回列数，42P13）。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 加法：只多末列 `last_checkin_id`（首附件 checkin_id 文本，
-- 非分享行回 NULL）；主體逐行沿 0014（`expires_at` 窗＋LEFT JOIN＋limit 箝位不動），
-- 旧客户端多一列忽略即兼容；route 映射见 conversations/route.ts（显式取列）。

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
    SELECT m.conversation_id, m.last_read_at, m.muted, m.hidden_at
    FROM conversation_members m
    WHERE m.user_id = p_uid AND m.hidden_at IS NULL
  ),
  last_msg AS (
    SELECT DISTINCT ON (msg.conversation_id)
      msg.conversation_id, msg.id, msg.sender_id, msg.kind, msg.body, msg.created_at,
      -- D.6 列表語音章秒數（首附件 secs；圖／文回 NULL，客戶端回通用章）
      (msg.attachments->0->>'secs')::int AS secs,
      -- UR E.13 分享卡片行（首附件 checkin_id 文本；非分享行 NULL）
      (msg.attachments->0->>'checkin_id') AS checkin_id,
      -- UR E.13 卡片地点行（首附件 place 文本；绝不放坐标）
      (msg.attachments->0->>'place') AS place
    FROM messages msg
    JOIN mine ON mine.conversation_id = msg.conversation_id
    ORDER BY msg.conversation_id, msg.created_at DESC, msg.id DESC
  )
  SELECT
    c.id, u.id, u.nickname, u.avatar_url,
    lm.id, lm.sender_id,
    -- DEF-20261003-003：enum 必须显式转 text（隐式无此转换，42804；0020 曾按 0014 重建丢过此行）
    lm.kind::text, lm.body, lm.created_at, lm.secs, lm.checkin_id, lm.place,
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

-- 匿名禁調（authenticated 可調；service_role 天然可調，沿 0014）
REVOKE ALL ON FUNCTION get_conversations(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION get_conversations(uuid, int) TO authenticated;

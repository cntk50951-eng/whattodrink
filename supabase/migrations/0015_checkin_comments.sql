-- UR E.7 打卡帖子留言：checkin_comments 表（可重放）。
-- 沿建表門禁：UI 面＝v2 自家 Sheet（C.4）＋他人卡（C.10）底部留言區；
-- 逐字段過堂：checkin_id（删帖级联）／user_id（登录态）／anon_id＋anon_ip_hash
-- （匿名双信号，hash 存不存原文）／body（≤500）／status（作者可藏评）；
-- 空窗安全：RLS 全 ENABLE，policy 同批（读沿帖可见性由路由再判，写只本人／帖作者删）。

CREATE TABLE IF NOT EXISTS checkin_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  anon_id text NULL,
  anon_ip_hash text NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS checkins_comments_checkin_created_idx
  ON checkin_comments (checkin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkins_comments_anon_outstanding_idx
  ON checkin_comments (checkin_id, anon_id, created_at DESC)
  WHERE user_id IS NULL AND status = 'visible';

ALTER TABLE checkin_comments ENABLE ROW LEVEL SECURITY;

-- 读：登录用户读自己相关＋公开（帖级可见性由路由按 canViewCheckin 再判，此处只开最小口）；
-- 匿名读由 service/anon key 经路由统一走（路由内用 service 旁路＋应用层判可见性，沿 D.2 建会话口径）。
DROP POLICY IF EXISTS "checkin_comments_owner_read" ON checkin_comments;
CREATE POLICY "checkin_comments_owner_read" ON checkin_comments
  FOR SELECT USING (auth.uid() = user_id);

-- 公开帖的可见评论人人可读（含匿名；friends／private 行路由内按 canViewCheckin
-- 用 authed/service 客户端再判，此处不开）。
DROP POLICY IF EXISTS "checkin_comments_public_read" ON checkin_comments;
CREATE POLICY "checkin_comments_public_read" ON checkin_comments
  FOR SELECT USING (
    status = 'visible'
    AND EXISTS (
      SELECT 1 FROM checkins c
      WHERE c.id = checkin_comments.checkin_id AND c.visibility = 'public'
    )
  );

-- 写：登录用户只能以自己身份写（anon 列由路由填，RLS 不拦 service；直连 anon key 写被拒，统一走路由）。
DROP POLICY IF EXISTS "checkin_comments_owner_insert" ON checkin_comments;
CREATE POLICY "checkin_comments_owner_insert" ON checkin_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 删：本人删自己；帖作者删该帖任何（防骚扰，路由内验帖归属）。
DROP POLICY IF EXISTS "checkin_comments_owner_delete" ON checkin_comments;
CREATE POLICY "checkin_comments_owner_delete" ON checkin_comments
  FOR DELETE USING (auth.uid() = user_id);

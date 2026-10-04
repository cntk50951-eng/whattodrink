-- UR E.18 首登資料：dob／bio／onboarded＋avatars 公開桶。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：
--   dob 存生日不存数字（显示年龄随算永不腐，顺带以后 18+ 门）；
--   onboarded_at 空＋created 7 天内即首登面板（提交／跳过即打戳）；
--   头像走签名直传（service 签，沿 uploads/sign 口径），公读靠 policy。

ALTER TABLE users ADD COLUMN IF NOT EXISTS dob date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- avatars 公开桶（SQL 建桶；Dashboard Storage 同样可见）。
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 读：公开可读（头像随帖可见，沿帖可见口径；路由不再二次验）。
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

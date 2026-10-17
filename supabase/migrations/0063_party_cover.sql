-- 酒局封面：parties.cover_url／cover_source ＋ party-covers 公开桶。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：
--   cover_source＝upload（自家桶，发布时过图审）｜poi（地图 POI 照片，白名单域名，只引用不转存）；
--   封面随看板公开可见（匿名可读列表），故桶公开读；写走 uploads/sign（service 签名直传，路径首段＝发起人）。

ALTER TABLE parties ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS cover_source text;
ALTER TABLE parties DROP CONSTRAINT IF EXISTS parties_cover_source_check;
ALTER TABLE parties ADD CONSTRAINT parties_cover_source_check
  CHECK (cover_source IS NULL OR cover_source IN ('upload', 'poi'));
ALTER TABLE parties DROP CONSTRAINT IF EXISTS parties_cover_pair_check;
ALTER TABLE parties ADD CONSTRAINT parties_cover_pair_check
  CHECK ((cover_url IS NULL) = (cover_source IS NULL));

INSERT INTO storage.buckets (id, name, public)
VALUES ('party-covers', 'party-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "party-covers public read" ON storage.objects;
CREATE POLICY "party-covers public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'party-covers');

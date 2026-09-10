-- UR A.3 / 酒圖標：beers 加 icon_url（公開 bucket 直鏈，NULL＝還沒畫圖走 emoji）。
-- bucket `beer-icons`（public）已由 Storage API 建好並灌入 30 張 SVG
-- （exported/beer-icons/svg，snake→kebab：asahi_super_dry.svg→asahi-super-dry.svg），
-- 這裡只補 RLS 公開讀 policy（bucket public 後匿名讀本就通，policy 補手續完整）。

ALTER TABLE beers ADD COLUMN IF NOT EXISTS icon_url text;

CREATE POLICY "beer-icons public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'beer-icons');

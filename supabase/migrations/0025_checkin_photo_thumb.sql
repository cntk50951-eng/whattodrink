-- UR E.20 他人釘照片縮影：縮圖列（列表只回此列，原圖永不進列表）。
-- 可重放：IF NOT EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：
--   96px JPEG data: URL（約 3–6KB），拍攝時客戶端順手壓，隨單存；
--   舊帖 NULL 即 emoji 回退（不回填，另議）；42703 老庫回退鏈不動。
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS photo_thumb text;

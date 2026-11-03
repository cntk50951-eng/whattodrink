-- 0071 多圖貼文（backlog_nov2 #8）
-- checkins.photo_urls：有序全量圖片列表（含封面，[1] 即 photo_url），≥2 張才寫；單圖貼文保持空數組，行為不變。
-- photo_url／photo_thumb 仍是封面（地圖釘、牆、個人頁網格都只用封面）。
-- 冪等；沒跑這條時 API 自動降級為只存封面（POST 遇 42703 去掉該列重試；GET 詳情單獨查、出錯當單圖）。
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';

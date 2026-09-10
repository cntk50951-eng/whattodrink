-- UR A.3 / A.2-1 seed：beers 15 條（lib/beers.ts 逐字直遷，id 穩定）。
-- 牆種子（MOCK_POSTS）故意不進庫：假用戶＋假讚數進真表就是污染，
-- 公開牆等真實分享再長出來。

INSERT INTO beers (id, emoji, name, category, tagline) VALUES
  ('heineken', '🍺', 'Heineken', 'lager', '加班過的救贖'),
  ('asahi', '🍻', 'Asahi 生啤', 'draft', '週五的快樂開場'),
  ('malbec-2021', '🍷', 'Malbec 2021', 'red wine', '一個人的儀式感'),
  ('yamazaki-12', '🥃', '山崎 12 年', 'whisky', '值得為自己慶祝'),
  ('mojito', '🍹', 'Mojito', 'cocktail', '朋友突然約的夜晚'),
  ('dasai-45', '🍶', '獺祭 純米大吟釀 45', 'sake', '今晚想對自己好一點'),
  ('ipa', '🍺', '本地精釀 IPA', 'craft beer', '想試點不一樣的'),
  ('gin-tonic', '🍸', 'Gin & Tonic', 'cocktail', '簡單但有態度'),
  ('rose', '🥂', 'Provence Rosé', 'rosé', '夏天傍晚的味道'),
  ('tsingtao', '🍺', '青島啤酒', 'lager', '配滷水一流的選擇'),
  ('sauvignon-blanc', '🍾', 'Sauvignon Blanc', 'white wine', '海鮮日的好搭檔'),
  ('highball', '🥃', '角嗨 Highball', 'highball', '清爽不烈的開胃'),
  ('stout', '🍺', 'Guinness 健力士', 'stout', '深夜慢飲的首選'),
  ('plum-wine', '🍶', '梅酒 on the rocks', 'liqueur', '想念家的味道'),
  ('espresso-martini', '🍸', 'Espresso Martini', 'cocktail', '需要撐到最後一秒')
ON CONFLICT (id) DO NOTHING;

-- UR A.3 / 啤酒牌子進目錄（26 行）：BEER_WALL 30 款扣掉已進的
-- heineken／asahi／tsingtao，再扣茅台（醬香白酒非啤酒，另議）。
-- 欄位口徑：name 取英文名（中文列是暱稱不能當展示名）／category 全進
-- 現有 lane（lager；少爺淡艾進 craft beer，Hoegaarden 小麥白啤暫進 lager，
-- 不同意可刪該行）／emoji 全 🍺／tagline 空等文案／icon_url 指 bucket。
-- ON CONFLICT DO NOTHING，可重放。

INSERT INTO beers (id, emoji, name, category, tagline, icon_url) VALUES
  ('corona-extra', '🍺', 'Corona Extra', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/corona-extra.svg'),
  ('blue-girl', '🍺', 'Blue Girl', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/blue-girl.svg'),
  ('hoegaarden', '🍺', 'Hoegaarden', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/hoegaarden.svg'),
  ('kirin-ichiban', '🍺', 'Kirin Ichiban', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/kirin-ichiban.svg'),
  ('yebisu', '🍺', 'Yebisu', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/yebisu.svg'),
  ('young-master', '🍺', 'Young Master', 'craft beer', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/young-master.svg'),
  ('budweiser', '🍺', 'Budweiser', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/budweiser.svg'),
  ('carlsberg', '🍺', 'Carlsberg', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/carlsberg.svg'),
  ('sapporo', '🍺', 'Sapporo', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/sapporo.svg'),
  ('snow', '🍺', 'Snow', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/snow.svg'),
  ('yanjing', '🍺', 'Yanjing', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/yanjing.svg'),
  ('harbin', '🍺', 'Harbin', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/harbin.svg'),
  ('bud-light', '🍺', 'Bud Light', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/bud-light.svg'),
  ('coors-light', '🍺', 'Coors Light', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/coors-light.svg'),
  ('miller-lite', '🍺', 'Miller Lite', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/miller-lite.svg'),
  ('modelo-especial', '🍺', 'Modelo Especial', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/modelo-especial.svg'),
  ('negra-modelo', '🍺', 'Negra Modelo', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/negra-modelo.svg'),
  ('pacifico', '🍺', 'Pacifico', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/pacifico.svg'),
  ('tecate', '🍺', 'Tecate', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/tecate.svg'),
  ('dos-equis', '🍺', 'Dos Equis', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/dos-equis.svg'),
  ('sol', '🍺', 'Sol', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/sol.svg'),
  ('bohemia', '🍺', 'Bohemia', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/bohemia.svg'),
  ('victoria', '🍺', 'Victoria', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/victoria.svg'),
  ('indio', '🍺', 'Indio', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/indio.svg'),
  ('skol', '🍺', 'Skol', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/skol.svg'),
  ('brahma', '🍺', 'Brahma', 'lager', '', 'https://aqtyqbjozqldqcpiyejm.supabase.co/storage/v1/object/public/beer-icons/brahma.svg')
ON CONFLICT (id) DO NOTHING;

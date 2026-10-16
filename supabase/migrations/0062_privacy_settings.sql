-- 0062 私隱設置 P2（用戶 2026-10-15 拍板：只有「足跡回放／打卡記錄／收藏」三項讓用戶自己設可見範圍）
-- 1) 足跡回放加 public 檔（原 off／friends）：public＝陌生人也能看（仍延遲 24h、坐標模糊、只含 public 打卡）。
-- 2) users.checkin_visibility：新打卡默認可見性（public／friends／private）；NULL＝跟隨賬號模式（舊行為）。
--    只影響新打卡，不追溯舊帖；隱身模式仍強制 private。
-- 3) users.saves_visibility：收藏可見性（public／friends／private）；默認 friends＝與舊行為一致（僅互為好友）。
--    無論設置為何，收藏列表只回「查看者本來就看得到」的帖。
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_trail_visibility_check;
ALTER TABLE users
  ADD CONSTRAINT users_trail_visibility_check CHECK (trail_visibility IN ('off', 'friends', 'public'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS checkin_visibility text;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_checkin_visibility_check;
ALTER TABLE users
  ADD CONSTRAINT users_checkin_visibility_check CHECK (checkin_visibility IS NULL OR checkin_visibility IN ('public', 'friends', 'private'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS saves_visibility text NOT NULL DEFAULT 'friends';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_saves_visibility_check;
ALTER TABLE users
  ADD CONSTRAINT users_saves_visibility_check CHECK (saves_visibility IN ('public', 'friends', 'private'));

-- 酒局封面新增来源 default（客户端预置 20 张默认封面，发布时随机选一张写进 cover_url＝default:N）。
-- 可重放。Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
ALTER TABLE parties DROP CONSTRAINT IF EXISTS parties_cover_source_check;
ALTER TABLE parties ADD CONSTRAINT parties_cover_source_check
  CHECK (cover_source IS NULL OR cover_source IN ('upload', 'poi', 'default'));

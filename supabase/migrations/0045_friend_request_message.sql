-- 好友请求附留言（WEB_HANDOFF_FRIEND_REQUEST_MESSAGE，iOS 输入）。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：message（请求附言，最长 50 字，server 截长度；空即 null）；
--   仅新建 pending 时写入（路由层保证；撤销即删行，留言同灭，不可编辑）；
--   RLS 无需动（friendships 读写已走 service，沿加好友 42501 修复）。

ALTER TABLE friendships ADD COLUMN IF NOT EXISTS message text;

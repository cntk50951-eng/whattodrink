-- UR D.10 §十五 修复迁移（0044）。可重放。Dashboard SQL Editor 贴跑，成功 "Success. No rows returned"。
-- 两段独立，可分开跑。

-- §十五.1：0043 回填按「现在」是否好友判定，把「曾是好友、已解除」会话里
-- 当好友时发的历史消息误标为陌生人消息，老会话一上来就显示已发满 3 条。
-- 修复：清掉本迁移执行时已存在的全部陌生标记，老会话从 0 起算（POC 可接受）。
-- 此后新消息按发送时定格，是正确的（解除好友的 DELETE 也会清标记）。
-- 代价：0043 到本迁移之间真实陌生人已发的条数会被重置（窗口通常为零）。
UPDATE messages
SET sent_as_stranger = false
WHERE sent_as_stranger = true;

-- §十五.3：B.3 返工前「解除好友」自动写入的 cheers_blocks 双向旧屏蔽行。
-- 旧解除是一条 upsert 语句同时写 A→B、B→A，两行 created_at（默认 now()）完全相同；
-- 手动屏蔽是单行单独请求，不会与对方镜像行同时间戳。
-- 判据：互为镜像 且 created_at 完全相同 → 删除（两行一起删）。
-- 清理后：加好友不再 404；碰杯不再被连坐（产品定案：解除好友不影响碰杯）。
DELETE FROM cheers_blocks a
USING cheers_blocks b
WHERE a.blocker_id = b.blocked_id
  AND a.blocked_id = b.blocker_id
  AND a.created_at = b.created_at;

-- 0057 投訴聊天記錄證據＋AI 分診記錄
-- chat_evidence：提交時對所選私信做的快照（私信 90 天過期、對方可能刪，快照保證審核時還在）。
-- 元素：{id, sender:'filer'|'target', kind:'text'|'image', body, at, image_path?}
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS chat_evidence jsonb NOT NULL DEFAULT '[]';

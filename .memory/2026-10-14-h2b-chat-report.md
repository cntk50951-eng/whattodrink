# 2026-10-14 — UR H.2(b) 房内聊天＋举报（残桩清理＋lint 两坑）

## 情境

- H.2 第二批：聊天两端点、举报、kick-block、friend origin、admin 页。

## 问题

1. 举报 AI 复核初版写了残桩（匿名快照里反查被举报人行，逻辑自相矛盾＋死代码 void）。
2. lint：`Date.now` 在 Server Action 里报 purity；站内 `<a>` 报 no-html-link-for-pages。
3. yaml `block` 缩进错层（python 插入按错了基准行）。

## 原因

1. 快照匿名化后想从快照找回被举报人——方向反了，应直接查该人最近消息。
2. purity 规则只认组件文件纯净，时间戳必须下沉到 lib（沿 complaintDecision 前例）。
3. edit 锚行只看文本不看层级。

## 修正

- reviewReportedUser 重写：查被举报人最近 10 条文本逐条 moderateCheckin；同房同人已有复核跳过；命中撤回＋ai_flagged；≥2 人升级禁言。
- `banGameUser` 下沉 `lib/complaintDecision.ts`；站内跳转改 `Link`。
- yaml 改用行号定位后手改缩进；`grep -n` 验 5 路径全在。
- 判例：匿名化是单向的——需要回查的一律另查库，不从匿名快照反推。

# 2026-10-12 — UR I.1 遇見搜索（陌生人位置不可见＋yaml 边界）

## 情境

- 新 EPIC I：LLM 翻条件＋代码查库打分，隐私由代码强制。

## 问题

1. 陌生人候选的位置／在线对搜索者是否可见——交接只写"大致距離"，未定口径。
2. yaml 大段插入两次吞了 `/games/rooms/{id}/invites:` 头（batch-2/3 同款再犯）。
3. 测试期望手算权重和，三处算错；`dropped` 漏未知顶层键。

## 原因

1. live 位置只对好友可见是既有隐私（toLiveFriend），陌生人距离即位置泄露。
2. edit 锚定行只取开始头，不验结束边界。
3. 权重表心算max，mutual_cap／online 常驻项漏加。

## 修正

1. distance_m／online 只对好友可见（陌生人 null／false；nearby 过滤即仅好友）；明确告知 iOS。
2. 补回 path 头＋grep 验三路径；判例重申：yaml 大段 edit 后必 grep 边界。
3. maxPossibleScore 含常驻项；未知键记 dropped；测试按公式写期望。
- 未做：LLM 理由润色（预留）、搜索历史、真机隐私矩阵（等 iOS）。

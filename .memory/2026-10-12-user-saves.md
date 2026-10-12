# 2026-10-12 — 看别人收藏（陌生人 403＋saves_total 归零）

## 情境

- iOS 别人主页要「收藏」标签；profile 只回计数，/me/saves 只给本人。

## 问题

- profile 的 `saves_total` 对陌生人回真实计数，与"列表看不到"不一致（格数对不上，且泄露收藏活跃度）。

## 原因

- 计数与列表走了不同口径（计数无可见过滤）。

## 修正

- 新 `GET /users/{id}/saves`（照 /me/saves 形；service 读；`saved_by_me` 按查看者重算——/me 版恒 true 不可照搬）。
- profile `saves_total`：本人／好友照旧，陌生人回 0（矩阵 C"统计只算看得到的"）。
- 判例：凡"计数＋列表"成对出现，两处用同一可见谓词。

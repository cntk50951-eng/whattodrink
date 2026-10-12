# 2026-10-12 — 头像签名回 publicUrl（复用网页口径）

## 情境

- iOS-0.92 换头像：sign＋PATCH 流程齐，只缺公开 URL（iOS 不持有 Supabase 地址）。

## 问题

- 网页用 `avatarPublicUrl` 现拼；iOS 写死地址换环境即坏。

## 原因

- sign 回包只给 bucket＋path，公开 URL 的拼装知识只在 web 前端。

## 修正

- `purpose=avatar` 时附 `publicUrl: avatarPublicUrl(env.url, bucket, path)`（其它 purpose 不回）；openapi 1.39.0。
- 未做：旧头像孤儿清理（不阻塞，另议）。
- 判例：凡"客户端要拼服务端才知道的地址"，都由签发端一起回，不让客户端拼。

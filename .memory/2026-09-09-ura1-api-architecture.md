# 2026-09-09 UR A.1 API 架構設計稿（EPIC 2 開篇）

## 情境
- 用戶：UI mock 差不多了，跨入 API 環節；讀 UR A.1（5 問：public／登入劃界、認證做法、框架選型、三端兼容、Vercel＋DB 集成），出架構文檔。

## 問題
- 無 auth、無後端：唯一路由是他人 lane 的 `/api/transcribe`；key 只有 `.env.example` 佔位（Supabase 新加坡區已註記）；表只有 `future-schema.md` 草圖。

## 原因
- UI-first 到此為止，EPIC 2 第一單必須先把契約和邊界定死，否則 A.2 建表無從下手。

## 修正
- 新 `docs/api-architecture.md`（10 節）：端點清單 16 條（public 5／auth 11，逐條標現 mock 去處）＋Supabase Auth JWT 雙通道（web cookie／原生 Bearer，RLS 第二道鎖，否決自簽）＋Route Handlers 單體（升級線留到 Hono 的觸發條件）＋三端同一 OpenAPI 契約（mock 層轉正離線 outbox）＋RLS 矩陣／Storage／Realtime 只開兩條＋Vercel（sin1＋env 分組＋1 cron）＋A.2→施工順序＋未決 5 問（登入方式／語音保留／匿名認領／限流／realtime 範圍）。
- backlog UR A.1 掛 [WIP]＋改動記錄；CHANGELOG 加 UR A.1 行。純文檔零代碼，未跑 gates（無代碼可跑）。

## 追記（分析師 review 合併，5 判斷＋3 加題全接受）
- 關鍵缺口是真缺口：三流歸一同表＋欄位級區分＝想喝誤上牆風險（PDPO 目的原則）。修：`type`＋`visibility` 雙欄，行級優先；`GET wall` 硬過濾。`future-schema.md` 同步（9b）。
- 檢舉門檻取 3（1 次只對檢舉人藏；小用戶基數下 3 可能難觸發，V1 cron 半自動兜底，已寫明）。
- 境外揭露／語音分層／五問定案全入 §10（未決→已決）。我的原稿被推翻的只有「欄位級足夠」的隱含假設，其餘成立。
- 關鍵決策備忘：consent／seen／guide flags 永久留本地不進庫；他人 pin 服務端砍精度；讚／乾杯冪等鍵；transcribe 版本化舊路徑 302 半年。

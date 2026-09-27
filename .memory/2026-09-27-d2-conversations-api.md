# 2026-09-27 D.2 會話 API 四端點＋並行 D.7 room 重構

## 情境

- D.1 green（用戶執行 0012），開 D.2（會話 API 四端點一次全上）。
- 同伴並行 D.7 room 重構：`[friendId]` 頁刪、`chat/page`＋`ChatThread`＋`V2Home(goChat→room)` 改、`room/`＋`chatPeer` 新。

## 問題

1. `server.ts` edit 切斷 `getAuthedClient` 註釋頭（oldString 取到註釋一半，即修）。
2. openapi 誤引 `schemas/Error`（正名 `ErrorBody`，4 處即修；另手滑刪 `CheckResult` properties 即恢復）。
3. tsc 報刪頁殘留（同伴刪 `[friendId]`，`.next/types/validator` 陳舊＋tsbuildinfo）——先誤判後定罪：清 tsbuildinfo 重跑，剩唯一 validator artifact（構建產物，非代碼錯）。
4. build 撞同伴進行中 build（"Another build running"），等 90s 重跑綠。

## 原因

- edit 錨點含註釋／代碼半截即整段吞——以後錨點只取標題行或完整語義塊（沿 C.11 round-10 教訓，第四次）。
- 並行刪文件＋`.next` 產物是 tsc 誤報源；定罪链：transpile 雙版→清緩存→剩 artifact 即收。

## 修正

- 四端點＋12 單測＋6 schemas；`createServiceClient` 加法；N+1 列表 POC 口徑（RPC 畢業線已記 UR）。
- 同伴文件零碰零恢復（D.3 換源改釘 room 頁，已記 D.2 改動記錄）。
- 三閘：build 綠（三新路由在表）／lint 0 error／338 綠；待用戶帶 session curl 驗。

## 關聯

- UR D.2 [WIP]（待 curl 驗＋合入）；D.3 待開（發送＋記錄＋Realtime＋room 頁換源）

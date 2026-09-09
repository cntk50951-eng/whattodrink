# 2026-09-09 UR4.1 v6 錄音空包真因＋拍照分享上地圖

## 情境
- 用戶：錄音還是播不出；且拍照分享全程要停在主頁地圖上，不要新頁面。

## 問題
1. 錄音：v5 只修了 key crash，錄→停→播鏈靜態看無斷點，但全檔根本沒人收 chunk。
2. 分享：扇形／選單／空牆三入口全跳 `/camera?auto=1` 獨立頁；submit 成功還推 `/wall/[id]`。

## 原因
1. `VoiceRecorder.start()` 建了 MediaRecorder 卻從未設 `ondataavailable`——`chunksRef` 永遠 `[]`，stop 拼出 0-byte blob，URL 有效但零聲音。之前兩輪全在修外圍（徽章／持久化／key／樣式），沒人讀過 start 那十行。
2. 拍照分享生來就是獨立頁路由，沒有「留在地圖」的形態。

## 修正
- 錄音：`ondataavailable` 收非空 chunk；拼包邏輯抽純函數 `buildRecordingBlob`（`lib/audio.ts`，空回 null）＋`lib/audio.test.ts` 4 單測；空包進 `empty` 狀態顯示 `recordEmpty`（三語已補，審計零缺口），不給啞播放鈕。
- 地圖：新 `CameraOverlay`（`/?shoot=1` 全屏層 `z-[1300]`，地圖常駐底下，沿 `?pick=1` 配方）；`CameraFlow` 加可選 `onClose`＋`exitAll`（restart＋關層；獨立頁無 onClose 沿舊行為）；submit 在 overlay 內轉 `received` 相（成功頁回家走 onClose），獨立頁照跳詳情；三入口改道 `/?shoot=1`；`/camera` 整頁保留 fallback。
- 門：127 綠（18 檔）／tsc 淨／lint 0 error（3 舊 warning）；`npm run build` 照例被 sandbox（Turbopack 子進程 bind port → EPERM，非代碼錯，待用戶本地驗）。

## 教訓
- 「播不出」先讀數據生產端（start/stop/onstop），不要從消費端（播放器／持久化）倒查——兩輪返工的學費。
- MediaRecorder 三件套（ondataavailable＋start＋stop/onstop）以後寫一起、缺一即錯；空 blob 守衛收進純函數吃單測，瀏覽器 API 本體留給真機驗。
- 全屏流程搬上地圖的固定配方：`?param=1`＋overlay＋可選 `onClose`＋成功態留層，獨立路由保留（pick 已驗證，shoot 照抄）。

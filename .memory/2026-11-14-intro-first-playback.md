# 介紹頁首次載入播放修復

## 情境
用戶回報 `/intro-next` 第一次載入無法開啟播放。先登記 DEF-20261114-002／UR M.3，僅修新版介紹頁啟動，不修改動畫、66 張圖片、原版或全站路由。

## 問題
原實作等 22 張 locale 圖片全部 decode 完成才掛載 Player，同時停用播放按鈕；冷啟動有任何慢載都會阻塞入口。暖快取重整可播放，不能據此判斷首次載入正常。

## 原因
把全片預載成功當作播放器可操作的必要條件，Promise.all 沒有期限。初始化 effect 也只依圖片 ready，而沒有依 Player ref 掛載。Remotion 官方 API 要求由使用者操作 play／toggle 時傳 SyntheticEvent；原 handler 丟失事件。

## 修正
- 改開場 Ivy／照片詳情／相機優先，最多等待 1.8 秒後放行；其餘背景每次兩張，單張 8 秒逾時繼續下一張。使用 load／error，避免 decode 佇列阻塞；維持同一 locale 的 srcSet／sizes。
- Player callback ref 同步至 state，實際掛載後才綁事件及初始化播放／預覽／減少動態；按鈕只在實際 ref 可用時啟用，手動 toggle 傳原點擊事件。晚到的圖片不會再次啟動或覆蓋使用者的暫停。
- 8 項 fake-timer 測試覆蓋全部請求懸置、提早就緒、失敗、延遲完成只放行一次、背景逾時、離頁／換語言清理、背景取消及響應式預載。瀏覽器實際驗三語自動播放及暫停／恢復，另驗 `?t=8` 凍結可手動播放。
- 官方參考：Remotion PlayerRef 的 play／toggle 與事件清理（https://www.remotion.dev/docs/player/player）；React callback ref（https://react.dev/reference/react-dom/components/common#ref-callback）；修改前已讀本機 Next.js lazy-loading 指引。
- 大段 apply_patch 若其中一行比對失敗，整份不會落盤；先核對實檔再套精確整行，不假設部分成功。
- build 132 頁成功。首輪全量 1,233 項過、既有 barDice.test.ts:184 模擬因並行 CPU 競爭超過 5 秒；不修改遊戲或測試期限，改以 `npm test -- --maxWorkers=2` 重跑，最終 117 檔／1,234 tests 全綠（該模擬 997ms）。lint 0 errors／12 個既有 warnings，新檔零警告。減少動態沿用原分支，沒有改系統偏好或宣稱已實機測該偏好。
- 同步 CHANGELOG、backlog、DEFECTS 及 docs/data/intro-marketing.md；不 commit／push／deploy，待用戶本地親驗。本輪未產生暫存檔。

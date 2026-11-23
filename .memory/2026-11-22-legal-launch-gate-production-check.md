# 關站期間核對正式法律頁

## 情境
用戶要在 `SITE_LIVE=false` 時公開 `/legal/privacy` 和 `/legal/terms`，回報兩個網址曾跳到 Coming Soon。

## 問題
本機 `main` 已包含 `172db05` 的法律頁放行規則，CHANGELOG 卻仍寫未部署。網頁擷取工具未能開啟網址，預設 sandbox 的 curl 也無法解析正式域名。

## 原因
本機提交與舊變更記錄只能說明程式和紀錄的狀態。正式站是否生效需要直接讀取對外 HTTP 回應和頁面內容。

## 修正
使用具網路權限的唯讀 curl 確認兩份文件的繁／簡／英版均回 200，並核對 HTML 標題。首頁和 `/wall` 仍回 307 到 `/coming-soon`。`lib/home.test.ts` 與 `lib/legal.test.ts` 共 30 項通過。更新 UR L.1 和 CHANGELOG 的驗證紀錄，沿用現有程式與封站設定。

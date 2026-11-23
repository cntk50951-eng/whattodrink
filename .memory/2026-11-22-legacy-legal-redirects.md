# 封站時也要查驗舊法律網址

## 情境
正式站 `/legal/privacy` 同 `/legal/terms` 已可公開開啟，用戶其後補充 `/privacy` 同 `/terms` 仍跳去 Coming Soon。

## 問題
上輪只驗證 `/legal/` 下的兩份文件，沿用舊網址的訪客仍去不到文件。

## 原因
`resolveSiteGate` 只識別 `/legal/` 入口，舊網址在封站時落入 Coming Soon 轉址。

## 修正
在封站規則加入兩條精確轉址，沿用有效語言前綴。開站由既有 `/terms` 頁提供模式說明。依 `DEF-20261122-001` 驗證新舊兩組網址、開站行為和封站邊界，新增的六項轉址單測在修改前可重現問題。

本機驗證時，Turbopack 在 compile 無進度，改用 `npm run build -- --webpack` 完成。`next start` 綁 `127.0.0.1` 時，預覽把預設語言 rewrite 到 `localhost`，造成自我轉址；改用 `--hostname localhost` 後正常。封站和開站合計 21 個 HTTP 回應符合預期。

發布前也以 `main` 加本次變更建立獨立快照。建置環境需提供虛構的 Supabase 公開與服務端值，讓既有後台頁通過環境檢查。快照建置產出 153 頁，135 個測試檔、1,361 項測試全數通過，lint 有 12 個既有警告及 0 個錯誤。

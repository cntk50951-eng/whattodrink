# UR L.1 全站開關＋coming soon（2026-11-02）

## 情境
新增 `SITE_LIVE` flag＋`/coming-soon` 頁：改 `lib/home.ts`、`lib/home.test.ts`、`proxy.ts`，新建 `app/[locale]/coming-soon/` 兩文件。

## 問題
1. 兩次 `edit` 的 `oldString` 吞掉相鄰代碼塊：第一次蓋掉 `resolveHomeTarget` 的註釋頭，第二次蓋掉 `describe("resolveHomeTarget (UR C.7)")` 行，單測直接 syntax error。
2. `resolveSiteGate("/en")` 誤判：裸 locale 根 split 後長度是 2，只寫了 `>= 3` 分支，單測斷言 `/en/coming-soon` 失敗。
3. 同一目錄起第二個 `next dev` 被 lockfile 攔（`Another next dev server is already running`），無法用雙 dev server 同時驗開／關站。

## 原因
1. `oldString` 取到「新函數結尾＋舊塊開頭」的交界行，edit 按字面替換把舊塊開頭吃了。
2. 只想到深路徑的 `["", locale, ...]`（長度≥3），漏了裸根 `["", locale]`（長度 2）。
3. Next dev 目錄級單例是已知機制，開工前沒想到驗證方案。

## 修正
1. 每次 `edit` 後立即 `read` 該區驗結構（兩次都是當場發現、當場補回）。
2. `resolveSiteGate` 補 `seg.length === 2` 分支；單測本來就寫了 `/en` case——先寫斷言的習慣救了一次。
3. 驗關站改用生產構建：`SITE_LIVE=false npx next start -p 3001`＋curl 六路（`/`→307、`/wall`→307、`/zh-Hans/wall`→307 語言保留、coming-soon 本體 200×2），不碰 dev server；驗完 `lsof -ti:3001 | xargs kill` 清掉。以後凡要「換 env 對照驗」，走這條，不另起 dev。

# 2026-09-04: sandbox 下瀏覽器截圖三條路全斷，自查改用結構校驗

## 情境

UR1.4 POC 優化後需視覺自查（Step 6），依序試了三種截圖方式。

## 問題

1. `agent-browser open/screenshot`：`Socket directory '/Users/yuki/.agent-browser' is not writable: Operation not permitted`——sandbox 只允許 workspace、/tmp、TMPDIR 寫入，agent-browser 的 socket 目錄在家目錄，被擋。
2. playwright（python）：chromium headless_shell 起得來但隨即 `TargetClosedError: BrowserType.launch: Target page, context or browser has been closed`——瀏覽器行程在 sandbox 下存活不了。
3. `/Applications/Google Chrome.app ... --headless --screenshot`：`Abort trap: 6`（SIGABRT），同樣起不來。

## 原因

本 session 的 shell sandbox + approval on-request 組合下，任何 Chromium 系瀏覽器行程都無法存活；與之前 session（無 sandbox 或不同 profile）能跑 playwright 的經驗不同。

## 修正

1. POC 這類純靜態 HTML 的自查降級為結構校驗：python `html.parser` 標籤平衡 + `node --check` 驗內嵌 JS，寫法見本次 `/tmp` 指令（效果等同 smoke test，不等同視覺驗收）。
2. 真正的視覺驗收仍走 Step 10a–10b：`open` 檔案讓用戶在自己瀏覽器親眼確認。
3. 之後若要我方截圖：先試 `agent-browser`（被擋即放棄，不要重試），再考慮請用戶用 `--disable-sandbox` 重啟 session 或用戶自己截圖貼回來。

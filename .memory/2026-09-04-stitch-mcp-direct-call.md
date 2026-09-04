# 2026-09-04: Stitch MCP 手動直連可用，07 對照原稿優化

## 情境

UR1.4 的 07-hand-drawn-doodle POC 要「先調用 stitch 再優化」。新 session 仍無原生 Stitch 工具（MCP 只在 session 啟動時載入，且工具箱固定），`~/.config/muse/settings.json` 也因 sandbox 讀不到。

## 問題

無原生工具時如何調 Stitch？

## 原因

Stitch 後端是標準 streamable HTTP MCP（`https://stitch.googleapis.com/mcp`，header `X-Goog-Api-Key`），只要會發 JSON-RPC 就能直連，不依賴宿主的 MCP 客戶端。

## 修正

1. `/tmp/stitch-mcp.py`（當時建、用完即刪，見 task-cleanup 規則）：initialize → notifications/initialized → tools/call，key 經 `STITCH_API_KEY` 環境變量傳入，完整回包存 `/tmp/stitch-last.json`（stdout 只印前 3000 字，因為回包常 >100KB）。
2. 先 `list_projects` 拿 projectId，再 `list_screens` 找 screenId（注意：screen 陣列包在 `content[0].text` 的轉義 JSON 字符串裡，要二次解析），再 `get_screen` 取 `screenshot.downloadUrl`，下圖到 `/tmp` 後用 `read_file` 看圖做元素級拆解。
3. 07 原稿要點（screen 507cd05b…）：奶油底＋pink/teal 大小不一散落氣泡；右上 cheers! 氣泡（黑手寫體＋pink 偏移影）；中央大啤酒杯（雲朵泡、左側滴落、杯身兩條波浪高光、雙線杯把、杯底動態線）；左側綠色酒花錐；上方兩枝金色麥穗。POC 原缺酒花＋麥穗、杯把是單粗線、氣泡只有 3 顆——已按此補齊，另補開獎動畫（doodleWobble）。
4. Stitch screenshot 的 `downloadUrl`（googleusercontent/aida）直接可下，無需額外鑑權。

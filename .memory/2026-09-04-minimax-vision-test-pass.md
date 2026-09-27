# 2026-09-04: MiniMax M2.5 看圖＋廣東話＋JSON 實測通過（UR2.4 選型）

## 情境

UR2.4 要「圖片＋文字（可空）交給 AI 分析」。測 MiniMax 能否做：vision 輸入＋廣東話理解＋UR2.5 的 JSON 輸出格式。

## 問題

官方文檔只寫 schema 有 `image_url`，未知哪個模型真吃圖、未知粵語理解、未知免 GroupId 能否調（`.env` 只有 key 無 GroupId）。

## 原因（實測結果）

`POST api.minimaxi.com/v1/text/chatcompletion_v2`（Bearer key，無 GroupId，照調）：model `MiniMax-M2.5` 吃 `image_url`（data URL）＋ system prompt（UR2.5 簡版）＋ user 粵語`今晚想飲啲清爽嘅`，回乾淨 JSON：`{"status":"success","drink_name":"Prosecco","reason":"意大利氣泡酒…"}`；reasoning 顯示正確理解廣東話。311 tokens，秒級回。

## 修正（結論＋缺口）

1. 供應商可用 MiniMax M2.5（已有 key 可用，key 格式 `sk-cp-*`，免 GroupId）。
2. 缺口：測試圖是 Stitch 塗鴉插畫非真實酒櫃，且 prompt 是簡版——防編造（只選圖中可見品項）要用**完整 UR2.5 prompt＋真實酒櫃照片**再測一次才能關。
3. 下一步動工：`lib/ai.ts`（server 調 MiniMax，key 不出 server）＋`app/api/analyze`＋結果頁（loading／無法辨識／逾時），接著做。

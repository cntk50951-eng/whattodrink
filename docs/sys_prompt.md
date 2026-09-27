# UR2.5 系統提示詞（定稿 v1，2026-09-04）

> 對應 backlog `UR 2.5 AI 系統提示詞設計`。本文件是 prompt 原文＋response 數據規範，
> UR2.4 前端照此解析。與 backlog 草稿差異：推薦數由 1 款改為 **3 款**，
> 無輸入時為**智慧隨機**（分散挑＋俏皮理由，仍限圖中真實品項）。

## 完整系統提示詞（copy-paste 用）

```text
你是「WhatToDrink」的選酒助手，一個懂酒但不擺架子、很會看場合的朋友，
不是專業侍酒師。語氣輕鬆、簡短、有梗，用香港 25-35 歲年輕人的口氣
（可自然用廣東話口語），絕對不要用「單寧」「餘韻悠長」「礦物感」
這類專業品鑑術語。

【輸入】
你會收到一張照片（通常是便利店或超市酒櫃），以及一段使用者文字
（可能為空字串，代表使用者什麼都沒說）。

【任務】
1. 先解讀照片：找出清楚可辨識品牌與品項的酒，以酒標上印的名字為準。
2. 結合使用者文字（若有），從照片中選出 3 款，按推薦度由高到低排列。
3. 每一款給一句推薦理由（40 字以內），輕鬆、有畫面感，可呼應使用者的
   心情、場合或食物。
4. 使用者沒有輸入任何文字時：照樣選出 3 款。用「智慧隨機」——在酒櫃
   不同位置、不同類型中分散挑，不要每次都選同一格；理由可以帶一點
   俏皮的隨機感（例如「今晚交給命運」），但仍必須是照片裡真實存在的品項。

【鐵律】
- 酒名必須是照片中真實可見的完整品名，不可編造、不可腦補沒出現的酒。
- 酒標文字若無法逐字讀出，視為不可辨識，不得靠瓶形、顏色猜品牌。
- 成功時必須剛好 3 款；若清楚可辨識的不足 3 款，回 unclear_image。
- 照片模糊、看不清酒款，或根本沒有酒（如零食貨架），回 unclear_image，不要猜。
- 照片有酒但完全無法辨識任何品項，回 no_alcohol_detected。

【輸出鐵律】
- 直接輸出純 JSON，第一個字必須是 `{`。
- 嚴禁 ```json 圍欄、嚴禁 markdown、嚴禁加註解。
- 只可用這四個 key：`status`、`drinks`、`message`；`drinks` 內只可用 `name`、`reason`。
- 成功範例（照此形狀，不要自創形狀）：
  {"status":"success","drinks":[{"name":"Jameson","reason":"順滑易入口，今晚慢慢嘆"},{"name":"Suntory Kakubin","reason":"濃郁帶甜，加冰一流"},{"name":"1800 Blanco","reason":"清爽龍舌蘭，shot 得起"}],"message":""}
```

## Response 數據規範（UR2.4 解析合約）

```json
{
  "status": "success",
  "drinks": [
    { "name": "Asahi Super Dry", "reason": "清爽辛口，配炸雞一流" },
    { "name": "…", "reason": "…" },
    { "name": "…", "reason": "…" }
  ],
  "message": ""
}
```

| 欄位 | 規則 |
|---|---|
| `status` | `success`｜`no_alcohol_detected`｜`unclear_image` 三選一 |
| `drinks` | `success` 時剛好 3 個，按推薦度排序；否則 `[]` |
| `drinks[].name` | 照片可見的真實完整品名，不可編造 |
| `drinks[].reason` | 繁中、≤40 字、輕鬆口氣、無品鑑術語 |
| `message` | `success` 時 `""`；失敗時給使用者的繁中友善提示（非空） |

TypeScript（UR2.4 用 zod 實作校驗，待建）：

```ts
type AnalyzeResult =
  | { status: "success"; drinks: [Drink, Drink, Drink]; message: "" }
  | { status: "no_alcohol_detected" | "unclear_image"; drinks: []; message: string };
type Drink = { name: string; reason: string };
```

## 測試紀錄（MiniMax-M2.5，temperature 0.2，2026-09-04）

- [x] 格式合約：3 次皆純 JSON、精確 key、3 款＋40 字內理由——PASS
- [ ] 成功路徑（Saraveza 遠攝）：回 3 款清酒名，圖中無此物——幻覺 FAIL
- [ ] 成功路徑（bar shelf 近攝，可驗證 Jameson／Bombay／Forty Creek）：回 Johnnie Walker／Glenfiddich／Chivas，圖中無——幻覺 FAIL
- [ ] 失敗路徑（塗鴉插畫，零真實商品）：回 success＋Tiger／Kakubin／Martell——應為 `unclear_image`，FAIL
- [ ] 語氣 review（AC4）：待 PM 確認
- **結論**：M2.5 格式服從滿分，但看圖說故事——酒標讀不出還堅持編名字，
  連鐵律都壓不住。UR2.5 AC1 在此模型上判定為 **FAIL，換模型重測**
  （架構原定 Claude API，視覺＋指令服從更強；需 `ANTHROPIC_API_KEY`）

## 調用參數（UR2.4 實作約定）

- model：`MiniMax-M2.5`，`temperature: 0.2`（穩定 JSON＋固定推薦，勿用預設高溫）
- `max_tokens: 1500`（大圖＋推理會食 token，300 會斷尾）
- 圖片預處理：最長邊 ≤1024px 的 JPEG（70KB 級別；668KB PNG 曾導致空回覆＋`finish: length`）

## 版本

- v1（2026-09-04）：初版定稿，待實測後修訂
- v2（2026-09-04）：實測 hardening——禁圍欄＋成功範例＋酒標逐字規則＋調用參數（大圖空回覆、schema 漂移、遠攝酒標幻覺三個坑）

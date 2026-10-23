# 2026-10-22 誰是臥底真聯機（UR H.3）

**做了什麼**：`game='spy'` 複用房間底座；`0067 spy_states`（整局秘密 jsonb＋rev 樂觀鎖）；`lib/games/spy.ts` 純引擎＋`spyStore.ts`（存取／CAS）＋`spyRoom.ts`（編排）；動作 speak_done／vote／rematch；GET 回按人裁剪的 `spy` 視圖；messages 按階段限發言人＋伺服器擋洩詞；離場＝出局。

**設計取捨**：
- 發言內容不進 state：發言就是房內聊天（`/messages`），伺服器只管「誰此刻可發文字」與「不能說出自己的詞」。state 只管階段／順序／截止／投票。
- 倒數到點用「懶結算」（GET／動作前推進，無 cron）；新截止時間從**舊截止時間**起算（久沒人輪詢也不多給時間），提前結束才從當下起算新的 60 秒。
- 身份規則：存活者連自己也不知道是不是臥底（只知道詞）；出局者身份在 result 公開；結束才公開兩個詞。events 絕不帶詞／身份；投票事件只說「有人投了」，投給誰到 result 才公開。
- `toRoomJson` 原本無條件用 `parseRules`（骰局房規）解析 rules，會把 spy 房規吃掉；已按 game 分支。新增遊戲時注意這種「通用層偷偷按單一遊戲解析」的地方。

**踩坑**：既有測試把 `parseActionBody` 的錯誤訊息寫死，新增 action type 後要同步更新；臥底房沒有 `game_rounds`，所以 `applyDeparture` 裡的骰局順延自然是空操作，只需在前面加 `applySpyLeave`。

**未驗證**：多手機真聯機（同步手感、倒數對時、斷線）；真庫上的 CAS 併發。用戶要做：SQL Editor 執行 0067。未 commit。

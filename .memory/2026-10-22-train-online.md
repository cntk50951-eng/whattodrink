# 2026-10-22 尾班車真聯機（UR H.4）

**做了什麼**：`game='last_train'` 複用房間底座；`0068 train_states`；`train.ts` 純引擎＋`trainWords.ts` 題庫＋`trainStore.ts`（存取／CAS）＋`trainRoom.ts`（編排）；動作 answer／again／rematch；GET 回 `train` 視圖；離場＝移出座位序。結構刻意與誰是臥底（`spy*.ts`）一致，之後加第三個聯機遊戲照抄。

**設計取捨**：
- **隱藏倒數必須在 server**：手機端若知道截止時間就能作弊。視圖只給量化「熱度」0–4（客戶端用來加速脈動與輕震），算不出剩餘秒數；單測斷言回包不含 `fuse_deadline_ms`／`fuse_total_ms`／`started_ms` 及其數值。
- 答案驗證只在 server（題庫在 server）→ 客戶端沒有打字自動完成（POC 有）；要做就得另開「建議」接口或下發題庫，是產品取捨，已列為非目標。
- 答錯不是錯誤：422 invalid_answer／409 duplicate 是正常遊戲結果，iOS `trainAnswer` 不走通用 `act()`（那會彈全屏錯誤），由輸入列就地提示＋震動，倒數照走。
- 倒數到點用懶結算（GET／動作前推進，無 cron）。輸家＝到點時拿著車的人。

**踩坑**：題庫從 POC 用 node `new Function` 抽出 JSON 再程序生成 TS，避免手抄 270 個答案抄錯；測試曾斷言回包不含 "fuse" 字串，但房規本身有 `fuse` 檔位欄位（short/mid/long）→ 改成斷言真正的秘密欄位名與數值。

**未驗證**：多手機真聯機；真庫上的 CAS 併發；題庫內容正確性（港鐵站名／電影／歌手都是常識整理，未覆核）。用戶要做：SQL Editor 執行 0068。未 commit。

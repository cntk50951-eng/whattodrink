# `.memory/` — 教訓與踩雷紀錄

`memory` 紀錄在這個專案犯過的錯、踩過的坑、找到的非顯而易見解法。

## 寫法

檔名格式：`YYYY-MM-DD-<slug>.md`

每條記憶**必須**含四個段落：
- **情境**：做了什麼 / 環境是什麼
- **問題**：出了什麼事 / 觀察到什麼
- **原因**：為什麼會這樣（技術原因）
- **修正**：之後要怎麼避免 / 怎麼做才對

## 何時新增

- 犯了明顯的錯（測試沒跑就 commit、token 推到 repo 等）
- 踩到工具鏈的坑（git 2.15 push 大 commit 要加 postBuffer）
- 找到非顯而易見的 workaround（shadcn 新版用 base-ui 而非 Radix）
- 重構時發現既有程式碼有隱性 bug，記下來提醒之後別再寫

## 何時讀

- **任何開發任務開始前**，至少讀最新 3–5 條
- 遇到錯誤訊息時，grep memory 看有沒有類似條目
- PR review 時如果 reviewer 引用某 memory 條目，看一下背景

## 與 `.harness/` 的關係

`memory` 是**觀察與事件記錄**，`harness` 是**穩定規範**。當某個 memory 反覆出現時，考慮把對應的修正寫進 `.harness/`，避免下次重蹈。

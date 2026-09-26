# 2026-09-26 workflow.md 預設跳過自動測試（成本考量）

## 情境
用戶反映 token 用量成本高，要我改 workflow：
- 自動測試（build / lint / test）預設不跑
- 瀏覽器測試由用戶本人起 dev server 手動驗
- AI 不主動起 server（per 既有偏好）

## 變更
- Step 5：「編譯驗證 + 單元測試」標 **預設跳過**（省 token）
- Step 6：「瀏覽器測試」改為由**作者本人**手動驗
- Step 10a：AI 不主動起 dev server，由作者起
- 例外：高風險改動（型別、API 契約、核心邏輯）才跑 build
- 9c 報備：gate 跳過時註明「按用戶偏好由作者手動驗證」
- 例外降階表加「預設」列：跳 build/lint/test、跳 AI 瀏覽器、作者起 server

## 教訓
- workflow.md 是 hard rule 文件，token 影響預設行為要直接寫進去
- 不要「我覺得該跑就自動跑」——已記錄的偏好（commit 後不起 server）必須嚴格遵守
- 高風險改動仍跑 build（型別檢查難用手動補救）；API 路徑建議跑 test

記憶關鍵字：default-skip-auto-tests、token-saving、manual-verification-by-author
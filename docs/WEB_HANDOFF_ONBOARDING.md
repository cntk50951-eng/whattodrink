
## web 回复（2026-10-12，已改未提交）
- **第 2 點（生日反覆修改）已修**：`PATCH /me` 的 `dob` 首次寫入後鎖定，改為不同日期回 `403 forbidden`（「生日首次填寫後不可修改，如需更正請聯繫客服」）；相同值放行（首頁重傳幂等）。未成年 `422 AGE_RESTRICTED` 發生在寫庫之前，dob 仍為空，可正常重試，無法繞過。契約 1.44.0。
- 老用戶：確認按你拍板強制（gender=secret／無 dob 會被引導擋住，onboarded_at 已有的不再看第 2–4 頁），web 不做改動。
- 本輪 web 側 tsc 零錯、614 綠、lint 零錯。**OnboardingTests 4 條在 iOS 端跑**（本倉無法執行 iOS 測試）。

# 2026-10-23 · 老實人·識破（shipo）聯機房

- 模塊 games / 關鍵詞 shipo 識破 瞎掰王 公三小 老實人
- 需求：iOS 提出，按瞎掰王原版；用戶授權 iOS session 直接改 web。契約交接見 iOS 倉 `docs/WEB_HANDOFF_SHIPO.md`。
- 做法：照抄尾班車的分層——`shipo.ts` 純引擎（懶結算＋樂觀鎖）、`shipoCards.ts` 卡庫（5 張，三語）、`shipoStore.ts`／`shipoRoom.ts` 存取與編排、遷移 0069；路由只接線。
- 秘密：身份與真相只在 server；`viewShipoFor` 只在 peek 給老實人真相，他人身份 result 後才公開；事件只帶公開資訊（公三小目標、指認目標）。
- 踩坑：
  - openapi `summary` 是未加引號的純文本，追加描述裡的 `: ` 會讓整份 yaml 解析失敗（js-yaml 驗：`node -e "require('js-yaml').load(...)"`）。
  - `ApiErrorCode` 是閉集，新增錯誤碼（not_judge／already_accused）要先進 `lib/api/envelope.ts`。
  - 測試別用超大 nowMs 推進狀態機：懶結算 while 會一路穿過多個階段。
- 未驗：真機多手機聯調、`npm run build`、0069 尚未在 Supabase 執行；真相文案是常識草稿，需人手覆核。

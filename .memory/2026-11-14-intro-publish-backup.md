# 原版備份與三語新版發布授權

## 情境
用戶明確要求：備份現有 intro，將新版 push GitHub 觸發部署，並提供頁面路徑讓用戶自行重新設計三語文案。這是新的明確發布授權，覆蓋先前「只本地、不提交部署」限制；不需要再次詢問 commit／push。

## 問題
直接替換 `/intro` 會失去可直接比較的舊頁；新版「查看原版」原連 `/intro`，替換後會自連。字串密集寫在 TypeScript，對編輯三語文案不方便。正式站另有 SITE_LIVE 封站，即使新版部署也會轉 coming-soon，不能把成功 push 當成公開可見。

## 原因
原版和新版分別存在兩條路由；發布時須同步導航與備份。全站封站是獨立於首頁的既有產品決定，授權 push 不自動等同授權開放整個 App。

## 修正
- 首先保存原頁於 `/intro-backup`，原 components/intro／public/intro 不動。標籤 `backup/intro-2026-11-14` 指向替換前 commit，`docs/intro-backup-2026-11-14.json` 留 24 檔雜湊、原頁及備份頁 SHA-256。
- `/intro` 使用新版三語，`/intro/artwork` 共用圖庫；`/intro-next` 保留預覽，語言／圖片入口依 basePath；查看原版指向備份，避免自連結。原版英文內容保持原樣，備份 noindex。
- 字串語義不變，抽到 copy.json，保留 copy.ts 型別檢查及路徑函數；用戶可以直接編輯 zh-Hant／zh-Hans／en。docs/intro-copywriting.md 提供逐欄說明與故事順序，圖片內 App UI 不隨網頁文案變更。
- GitHub main 原與本地相同；提交只包含 intro 相關檔、素材與累積記錄，不帶 reports／research_notes／.env。採專案 github-api（REST＋curl）及 code-review 技能，無新依賴。
- GitHub 部署的 instance URL 受 Vercel 登入保護，不能將其 200 登入頁當正式站；從既有 memory 找到正式 alias `https://whattodrink-psi.vercel.app`，確認目前會轉 coming-soon。用戶回覆明確要求保留 Vercel 的 SITE_LIVE flag 控制，產品未公開，繼續跳 coming-soon；不放行 intro，不改 proxy／lib/home／.env 或遠端環境變數。正式內頁路徑提供作部署位置，本地與 GitHub 文案檔可編輯。
- build 138 頁成功；intro 8 檔／108 tests、全量重跑 118 檔／1,237 tests 通過；lint 零錯／12 既有 warnings，新路由及檔案零警告。部署成功以 GitHub 的 Vercel 狀態回報為準；公開 alias 的 coming-soon 跳轉保留是本輪預期。
- 此輪最初本地 3000 已無程序，HTTP 連線被拒絕；重啟 `SITE_LIVE=true npm run dev`（僅程序級，不改 .env）。全量首輪遇已記錄的 barBlackjackStore.test.ts:76 隨機天然牌局導致 ID 不同（1,236 項過），不混入修改遊戲測試，單獨重跑全量驗證。

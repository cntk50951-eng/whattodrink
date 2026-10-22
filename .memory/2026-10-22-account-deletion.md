# 2026-10-22 帳號注銷（UR I.3）

**做了什麼**：`DELETE /me {mode,confirm}`、`POST /me/restore`、`GET /me/deletion`；0066 `account_deletions`（無 FK、快照 jsonb、purge_at）；`lib/accountDeletion.ts`（純函數＋service IO）；排程 `/api/internal/purge-accounts`（vercel.json＋CRON_SECRET）；openapi 1.57.0；10 條單測；tsc 零錯＋930 綠＋lint 零錯。

**方案**：grace＝快照→記表→刪實際數據（對所有人自動消失，不改 46 個讀 users 的路由）；恢復只回填個人資料＋自己發的內容；now＝清文件→刪數據→刪登入帳號。

**踩坑**：
- 約 16 個外鍵是 `ON DELETE SET NULL`（checkins、checkin_comments、post_likes、mood_logs、cheers、drink_invites、devices、post_reports、party_events、notifications.actor、game_events），刪 users 行不會清，必須主動刪（`CLEANUP_COLUMNS`）；`checkins_archive` 無 FK 也要清。新增有 SET NULL 的表時要補進清單。
- `users.id` 不連 auth.users；恢復期保留登入帳號，並在 me／friends／checkins 三處「缺行自建」前判斷 `isDeletionPending`，否則會建出空行撞上恢復。
- 用戶檔案在桶 avatars／chat-images／chat-voice／party-covers 的 `${userId}/` 前綴下；Storage list 只列一層，要遞歸。
- 用 `import type` 引 `createServiceClient`＋函數內動態 import，避免純函數單測拉進 next/headers。

**未驗證**：真庫上的清除／恢復（只有純函數單測）；`npm run build` 未跑。用戶要做：SQL Editor 執行 0066；Vercel 設 CRON_SECRET。未 commit。

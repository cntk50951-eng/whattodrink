# 2026-09-27 Vercel main 部署紅（DEF-20260926-016）

## 情境

用戶貼 Vercel 失敗日誌：build `fd54300` 掛在 TypeScript，`wall.ts` 找不到 `./andes` 等模塊。

## 問題

- `fd54300`（我的 PR #20 merge）樹內 wall.ts 已帶 batch3a＋batch3 的 import，但 15 枚 `.tsx` 不在倉內。
- 我的子集經 contents API 驗過干净——髒來自並行線。

## 原因

- 部分推送：接線（wall.ts／index.ts／manifest，tracked）先行，`.tsx` 新文件還躺在 untracked——`git commit -a` 只交一半的經典事故。
- 另：`rtk git log` 會吞掉 HEAD 首行，本輪三次誤讀 graph；改原生 `git rev-parse`／`show` 才定罪（工具鏈坑，已记）。
- 另：Turbopack 拒 symlink 的 node_modules（`points out of the filesystem root`）——worktree 隔離驗證改走 `tsc --noEmit`（正好即 Vercel 掛點）。

## 修正

- 對方 `a8e28c2` 已補齊樹（merge：同步遠端 C.5 並合入 icon15 枚）；我方零碰工作區，用 `git worktree` 隔離驗該 commit：tsc exit 0＋vitest 30 文件 253 綠。未動對方任何文件，未提交任何東西。
- 落 DEF-20260926-016（Closed）＋本篇；BACKLOG 不另開 UR（並行線範圍）。
- 新一輪並行 batch（aguila／balboa 等，wall.ts／index.ts 已髒、`.tsx` 在倉）目測同配方，告警已在下文回覆裡給用戶，未動手。

## 追補（遠端仍 v1 排查，2026-09-27）

- 遠端 main 已走到 `9504922`（對方空合併同步＋C.8 等）；C.7 跳轉碼在倉（proxy＋`lib/home.ts` 俱在）。
- worktree 鎖 tip 驗：`tsc` 淨＋vitest 32 文件 271→268 綠（數隨對方測試增減，當輪 268），源樹健康——問題不在代碼，轉 Vercel 側（部署狀態／env／域名／緩存四查，用戶 dashboard 動作）。

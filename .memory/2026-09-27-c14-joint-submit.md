# 2026-09-27 — C.14 聯合提交＋同樹協作教訓

## PR #29 `e27727f`（聯合提交，用戶授權整樹一次）
- 內容：我的 C.14 round-2（mapSpread＋散開＋+N＋堆疊 Sheet＋stack*三語＋006/008落条＋C.14[✓]前狀態）＋隊友進行中：C.13（trail/city/geoAreas＋trail.c13.test）＋C.15（chat雙頁／ChatThread／lib/chat＋chat.test＋shadcn avatar/input/scroll-area）＋V2ChatSheet 退役（V2Home 已改接新 chat，build 证）。
- 三閘（全樹）：build 41頁／lint 0 error／test 321綠（38 files）。
- 代修（記清楚，還人情）：`ChatThread.tsx` 2 個 `set-state-in-effect` error——reducedMotion 改 lazy init（零行為差）；threadKey 重置加 `eslint-disable`＋TODO(C.15)（正當 props-sync，待隊友改 key-remount 後刪）。
- C.14 置 [✓]、DEF-006 轉 Fixed（親驗欠：雙號散開／+N 列表）；DEF-008（回位）Open 待用戶補三問。

## 同樹並行：從「踩雷」到「流程」
- 實錘三件：① DEFECTS.md 的 006 整段被回退（隊友同文件並寫，last-write-wins）；② 我的 `onStackClick` 被改 optional；③ 我的 007 與隊友的 007 撞號（我讓號改 008）。
- 根因：同一工作樹＋同一文件並寫，無鎖無 merge——不是惡意，是機制缺失。
- 對策：docs 操作後當輪 grep 回驗；撞號讓號＋留痕；不同人的條目互不改只追加；提交前 `git status`＋`git diff --stat` 通讀（這次 package.json 的 M 消失了——隊友自行 revert，萬幸 build 前驗了）。
- 給用戶的建議（已口頭）：同樹並行需打招呼；docs 文件是最高危區。

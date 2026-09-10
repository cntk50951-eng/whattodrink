# 2026-09-10 UR A.5 換一批 bug（診斷漫遊教訓＋真下一批）

## 用户原話鏈（別再誤讀）
- 「選了啤酒，無法換一批」→ 我先誤判想喝換酒面板，又誤判靜態小池（H1）。
- 用户糾正兩次：(1) 不是紀錄換酒鈕，是推薦 L2；(2) 看到的是 Miller/Indio/Tecate/Hoegaarden/Blue Girl（**牌子行＝41 目錄活著**），重開會換新，缺的是換批鈕。
- 教訓：**先問清「你看到的具體是哪些名字」，再定分支**。名字一報（牌子行）H1 當場死亡，省三輪推理。

## 根因（雙層）
1. 舊換批＝同池重洗＋防連同（3 次重試），31 池裡常給重臉，體感「沒換」。
2. 換一批鈕自 UR3.9 就在（`git log -S pickNextBatch`：4d0d504，比 `fetchBeers` 的 b0c91a1 老），任何看得到牌子的 bundle 裡它一定渲染過——用户沒看到＝被 sheet `max-h-[50%]` 折疊到點點下面了（可發現性 bug，不是缺鈕）。

## 修法（已落地未提交，待用户親眼）
- `lib/beers.ts: pickNextBatch(seen, categoryId, count, rand)`：池扣當前批，剩的夠 count 只抽新的；不夠回退整池重洗；unknown lane 走全域；不動源數組。
- `DrinkMap handleRefreshBatch` 改調它（重試循環刪了）；鈕搬 L2 header（label 同行右側，不用翻 sheet）；池 ≤ 已展示數置灰（紅酒 1 款即灰，AC#2）；底部只剩換大類全寬；零新 i18n key。
- 單測 6 個進 `lib/beers.test.ts`（合成 12/8 行 lager 目錄＋靜態池＋afterEach 還原，抄 `beers-api.test.ts` 的 PRISTINE 套路）。
- 三閘：152 綠／tsc 淨／lint 0 error（3 warning 全在 layout/theme-switcher，pre-existing）。

## 未決
- 用户說滑動「最多只有 5 個」：31 池 count 6 應出 6 張，待驗收時順帶確認（數點點數／aria-label `x/6`）。
- 想喝換酒面板維持舊語義（用户說好的，不動）。

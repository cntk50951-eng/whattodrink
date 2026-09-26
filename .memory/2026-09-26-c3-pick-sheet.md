# 2026-09-26 UR C.3 選酒弹窗 shadcn 化＋去 v1 味

## 情境

C.1 驗收：選酒弹窗殼是 Sheet 但裡子舊（原生 h2、手搓 button、裸 img、kinds 無返回），且內容層仍是 v1 味（emoji 主導＋舊網格）。

## 問題

- 無障礙：Dialog 無 Title；弱網圖片白閃；kinds 死胡同（只能落釘不能回）。
- 觀感：L1 2×2 大 emoji 格一眼 v1；L2 卡大小不一。

## 原因

- C.1 只換了殼和 L2 卡皮，標題／返回／加載態留白；內容 IA 照搬 v1。
- Skeleton／ScrollArea 装不上（npx 本機不通），只能用 Tailwind 原子拼。

## 修正

- SheetHeader／Title／Description（三段＋守衛）；抓手 div；BeerImg（pulse 佔位＋淡入＋壞圖回 emoji，模塊級組件）；batch／kinds 返回鍵；L1 改單列列表行（文字主導＋小圖標格＋右箭頭）；L2 卡統一正方圖區。
- v2.back×3 parity PASS；grep 驗零原生 h2／button；三閘綠。
- 三閘：241綠／lint 0 error／build 39頁；用户浏览器覆盖。

## round-2 配色（2026-09-26）

- 根因：Sheet 經 Portal 掛 body，逃出頁面 `.v2scope`，吃 `:root` doodle 舊 token（米黃紙色）——頁面現代、彈窗 v1。
- 修：兩 SheetContent 根自帶 `styles.v2scope`（token 帶進子樹；v1／globals／共用層零動）＋sm 居中窄欄＋L1／kinds 圓角芯片統一。
- `font-heading` 已驗＝`var(--font-sans)`，無手寫字體洩漏。

- 關聯 UR C.3 [✓]；v1 零文件；共用層零改；用戶驗收通過，已合入 main

# 2026-09-26 UR C.7 首頁路由切 v2

## 情境

用戶指令：`/`（本地＋遠端）預設進 v2，要配置隨時切回。EPIC C 鐵律第 5 條預留的入口 UR。

## 修正

- `proxy.ts` 門前加道：裸 `/`＋`HOME_UI=v2`→307 `/v2`；其餘直通 intl＋session 原鏈（v1 一個字節不動）。
- `lib/home.ts` 新（`parseHomeUi` 缺省 v2＋`resolveHomeTarget` 僅裸 `/`；`?pick=1` 深鏈永不劫持）＋6 單測。
- `.env.example` 說明（Vercel 改值需 redeploy，proxy env 編譯期烘焙）。
- 本地四路實測：／→307、/?pick=1→200、/v2→200、HOME_UI=v1→200。
- 三閘：263綠／lint 0 error／build 39頁；用户驗收通過。

## 關聯

- 關聯 UR C.7 [✓]，已合入 main（插畫並行施工，只交 C.7 hunks）

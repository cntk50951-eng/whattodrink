# 2026-09-27 — 同樹並行踩雷＋重疊散開定案

## 同樹有人，docs 會被回退（P0 教訓）
- 現象：`docs/DEFECTS.md` 裡我當輪落的 DEF-20260927-006（表格＋詳情）整段消失，文件回退到 HEAD；同時 `V2MapView.tsx` 裡我的 `onStackClick` 必填 prop 被改成 optional＋`?.` 調用。
- 判定：隊友（或其 agent）在同一工作樹活動：同期 `M lib/city.ts lib/geoAreas.ts lib/trail.ts package.json`＋`?? components/ui/{avatar,input,scroll-area}.tsx lib/trail.c13.test.ts`（他們在裝 shadcn＋寫 C.13）。
- 對策（已執行）：006 重建＋加「協作備註」行；`onStackClick?` 功能無礙，保留不打架；提交前走 split-car（只帶己方 hunks），且提交前重驗 `git status`。
- 教訓：並行期間任何「edit 成功」都不等於落地——關鍵文檔操作後當輪 grep 回驗；發現 docs 回退先別罵人，重建＋留痕＋口頭同步。

## 重疊散開：研究→定案（DEF-006 round-2）
- 地圖側業界口徑：OMS／Leaflet.markercluster（點擊蜘蛛散開）vs 新派 density-spread（像素碰撞即 Vogel 螺旋自動散開，zoom 無關視覺分離；opencupid PR 實證：純函數＋單測＋zoomend/moveend 重算，不引依賴）。
- shadcn 側正統：AvatarGroup 重疊棧＋max＋`+N` overflow button＋popover 列表（含 a11y：`aria-expanded`／`aria-controls`／Esc 關）。
- 定案（用戶拍板全套）：live 釘永不進散開輸入（活人釘死真位）＋啤酒釘 Vogel 自動散＋live 徑向避讓＋超 cap(6) 收 +N＋堆疊列表 Sheet（沿 C.4/C.10 語言，行點開卡＋一鍵散開復用 C.6 `spreadIds` 圓周路）。
- 落碼：`lib/mapSpread.ts`（`planSpread`／`avoidLive`／`vogelOffset`／`groupOverlaps`）＋9 單測＋1 快照（`toMatchSnapshot` 鎖螺旋）；`V2MapView` z>11 簇徽退役（`clusterPoints`／`V2_CLUSTER_PX` 接線刪除）；`V2MapApi.spreadStack`。
- 用戶原話約束：「live釘永遠真位」「三態（我／打卡／友）必須分清」「閃爍圈要讓人知道我們在哪」——後續調參先回這三句。

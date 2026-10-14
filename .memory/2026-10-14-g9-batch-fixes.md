# 2026-10-14 — UR G.9 四個順手修正（tsc＋lint＋邏輯）

## 情境

- G.9 大批量（遷移＋路由＋兩純函數＋四組件＋地圖層）一次寫完，gate 抓四錯。

## 問題／修正

1. `meJson` 先用後聲明（新 pin 區塊插到 `meJson` 聲明前，tsc 2448）：整塊搬到 me effect 之後（python 搬移，tsc 淨）。
2. 新 effect `refreshPinned()` 撞 `set-state-in-effect`：沿 hydrate 口徑加單條 disable（多加的 exhaustive-deps 那條報 unused 即刪）。
3. `??`＋`?:` 混寫優先級坑（pin 名）：拆臨時變量再判空，不一行寫完。
4. 歸檔讀他人行：authed client 受 RLS owner 限改走 service＋`canViewCheckin` 代碼門（沿詳情口徑）；`toMineRow` 本就容 beers null／photo null，免手拼。

## 判例

- 大批量先過 tsc 再過 lint（類型錯多半是放錯位置，移塊即解）。
- 凡讀 archive 他人行，一律 service＋代碼門（RLS owner-read 是硬牆）。

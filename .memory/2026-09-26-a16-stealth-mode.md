# 2026-09-26 UR A.16 隱身模式實作

## 情境

A.15 拍板後實作隱身模式：`GET/PATCH /api/v1/me`（A.4-6 子集先行）＋城市卡三檔切換＋五處寫守衛（打卡沿既有 403、乾杯／邀約／讚／拍照新建前端攔截＋共用 ModePrompt 一鍵切換）。

## 問題

- `hooks/useMyMode.ts` 初版在 render 內寫 `modeRef.current = mode`（patchMode 回滾用），lint 報 `react-hooks/refs` error。
- `submit`（camera-flow）新增 `mode` 引用後 deps 數組需同步，否則 exhaustive-deps 告警。

## 原因

- 已知坑重踩：UR2.9 memory（`2026-09-07-ur29-shake-feel.md`）早有「cleanup 讀過的 ref 別處不許寫」教訓，本次是同一規則另一面（render 內不許寫 ref）。
- `useCallback` 引用外層 state 必須進 deps（既有配方：DrinkMap 內多處同 pattern）。

## 修正

- ref 同步改 `useEffect [mode]`（沿 UR2.9 配方）；`submit` deps 補 `mode`。
- 三閘：test 220/220（`lib/mode.test.ts` 10 新測）、lint 0 error（3 舊 warning）、build 31 頁（含新 `/api/v1/me`）。
- 文案防炸：`mode` 命名空間 16 key × 三語 parity 腳本驗 PASS（沿 UR4.1 v5 缺 key 炸樹教訓）。
- 心跳：全庫確認無 `last_seen_at` 寫入代碼（僅註釋＋pins 讀路徑），隱身「不上報」零代碼即達成，不新增心跳寫入。

## 關聯

- 涉及：`lib/mode.ts`、`hooks/useMyMode.ts`、`components/auth/ModePrompt.tsx`、`app/api/v1/me/route.ts`、DrinkMap／MapHotBoard／PostDetail／camera-flow 守衛、`docs/api-openapi.yaml`（Me＋/me）、`docs/data/home-map.md` 第九節
- 測試：`lib/mode.test.ts` 10 測（parse／守衛／toMeJson 回退）

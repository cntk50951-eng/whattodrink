# MapPin 加 authorAge：共享型別加必填欄位要掃全 repo fixture

## 情境
把 `PinJson` 加 `authorAge`（`lib/api/pins.ts` 用 `ageOf(authorDob, nowMs)` 算足歲）並補 `lib/api/pins.test.ts` 斷言、openapi 1.65.0。gate 跑 `npm run build`。

## 問題
`npm run build` 型別檢查失敗：`components/v2/v2Pins.test.ts` 三處 PinJson mock 缺 `authorAge`（TS2741）。原本以為只改 pins 自己的 test 就夠。

## 原因
`PinJson` 是跨模組共享型別（API mapper→v2 組件），加**必填**欄位會令所有手寫 fixture 一齊紅；只改同檔 test 會漏。

## 修正
1. `v2Pins.test.ts` 三個 mock 補 `authorAge`（有 dob 的填 26、null 的填 null），build 重跑轉綠（27 tests 綠）。
2. 以後共用型別加必填欄位：先 `grep -rn "<型別名>"` 掃全部 fixture／mock，再一次補齊，再跑 build 驗，不要只信同檔 test。

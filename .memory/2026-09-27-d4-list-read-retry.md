# 2026-09-27 D.4 好友列表＋已讀＋重試（實作完待驗）

## 情境

- 用戶：開工 D.4（列表＋未讀＋已讀＋重試＋friendsOnly 退役）。

## 問題

1. lint 2 error：列表頁 `Date.now()` render 內（改 state 凍結）＋水位輪詢首呼 set-state-in-effect（加理由豁免，沿本文件先例）。
2. `chat.test.ts` 誤刪 `it(` 行（edit 錨點取到塊首，即讀即補）。
3. 空會話行做不了：無好友列表端點（只有 `/friends/live` 在線），列表＝有記錄會話＋在線點。

## 原因

- 受控源三段 edit 漏聲明提升（ Despite prior lesson，同類第五次——錨點教訓仍需刻進肌肉）。
- RLS 讀不到對方水位行，故開 `read-status` 端點代查（設計時已定，實施兌現）。

## 修正

- 列表（在線置頂＋離線＋末句＋時間＋未讀＋空態）＋pill 改導航＋退役刪淨（含死 key）＋`read-status`＋10s 輪詢＋✓✓＋失敗重試（同鍵冪等）＋`formatListTime`＋3 單測＋3 組 key。
- 三閘：build 綠／lint 0 error／345 綠；tsc 唯一殘留刪頁 artifact。
- 待親驗＋合入；空會話行缺口記 UR（需好友列表端點時另開）。

## 關聯

- UR D.4 [WIP]；D.5b／D.6 另期

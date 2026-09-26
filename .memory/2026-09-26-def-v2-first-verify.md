# 2026-09-26 v2 首驗兩連修（DEF-010／011）

## 情境

C.1 首驗：Console 爆 base-ui nativeButton 錯×3；v2 看起來像 v1（塗鴉色）。

## 問題

1. `Button render={<Link>}` 未配 `nativeButton={false}`（v1 mood 頁有配方，v2 漏抄 4 處）。
2. 語義 token 正確，但值被運行時 doodle 主題污染（`LOCKED_THEME_ID` 灌 `<html>` 繼承鏈）。

## 原因

1. base-ui Button 默認 native 語義，render 非 button 即報錯（非 warning，是 error）。
2. Token 名對、值錯：問題在值層（運行時主題），不在組件層。改組件越改越偏。

## 修正

- 4 處全補 `nativeButton={false}`；附带修 `v2noscroll` 明串誤用（module hashed 名，否則滾動條藏不住）。
- 新增 `v2scope` 作用域覆蓋：淺灰底／白卡／柔邊／琥珀主色＋深 slate 字（淺金底白字對比不足，故深字）；`color-scheme: light`；`globals.css` 一字未動，v1 零影響（用戶回歸目檢確認）。
- 三閘綠；待用户复验（Console 乾淨＋現代感目檢）。

## 關聯

- 缺陷：DEF-20260926-010／011（Fixing）；關聯 UR C.1 [WIP]

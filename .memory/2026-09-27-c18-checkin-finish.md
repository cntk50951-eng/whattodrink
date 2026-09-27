# 2026-09-27 C.18 打卡收尾：飛新釘＋冒泡罩＋flyTo 補降級

## 情境

- 用戶報 defect 兩件：①拖偏地圖後打卡，成功不飛新釘 ②快貼/帖子提交慢網乾等零反饋，要啤酒冒泡 loading＋自動 dismiss。
- 版本問答：只改 v2，一律飛（不判視野）。

## 問題

- 成功分支缺收尾：v1 `dropWantWithKind`／v2 `dropWant` 成功只寫 state＋關面板，零鏡頭動作（v1 實證行號已記 DEF）。
- POST 期零 submitting 態，按鈕可連點。
- AC 自查抓到：`V2MapApi.flyTo` 無 reduced-motion 降級（fitPoints 有，flyTo 沒有）。

## 原因

- A.12 雙寫兼容只顧數據落庫，忘了鏡頭是打卡體驗的一半；loading 是當時沒做，不是退化。

## 修正

- 成功雙分支 `flyTo(position, 15)`；`submittingRef`（ref 防同 tick）＋`checkinSubmitting`（state 驅罩）；罩 `z-1000`＋吞點擊＋`role=status`；403／登入中途返回 dismiss 不飛。
- `flyTo` 補 reduced 降級（V2MapView 單處，diff 驗 100% 我的）；`v2.checkinSubmitting`×3 parity。
- tsc 淨／lint 0 error；無新純函數故無新單測（沿 testing.md 口徑）；build 跳過（用戶偏好，用戶手動驗）。
- DEF-20260927-011 轉 Fixing＋關聯 C.18；v1 同病記錄在案不搭車。

## 關聯

- UR C.18 [WIP]；DEF-20260927-011（Fixing，待親驗：拖偏飛釘＋慢網冒泡＋連點一次）

# 2026-09-26 UR A.18 T&C 頁＋EPIC B 立項

## 情境

用戶指令：構建 A.18；同時好友邀請消息隊列立 EPIC B 管理（含表補強 audit 列）；realtime 靜態刷新收發回。

## 問題

- Footer `/terms` 死鏈（404），`/privacy`／`/about` 同病（本 UR 只補 terms，其餘記缺口）。
- friendships 只有雙方 id＋狀態，無時間／來源可 audit。
- 單向邀請靜默入庫，對方零感知（A.19 驗收結論）。

## 原因

- T&C 文案 A.15 D6 早有大綱，只差落頁。
- V1 好友流為驗證行手插設計，無 inbox 概念；realtime 需 Publication＋REPLICA IDENTITY 等 Dashboard 動作，屬用戶側前置。

## 修正

- A.18：`app/[locale]/terms` 純靜態 Server Component（mood 版式＋塗鴉卡，零客戶端 JS）；terms 14鍵×3 parity PASS；Footer 鏈零改生效；公開收尾零代碼（回歸隨瀏覽器）。
- EPIC B＋B.1＋B.2 建檔置[]：B.1 加 `updated_at／responded_at／expires_at／source_checkin_id`（地點時間由來源行 join，不冗餘經緯）＋`POST /friends` 寫 expires_at；B.2 邀請中心（列表＋接受／拒絕＋realtime＋lazy 過期，入口三選一待決）；實現待拍板。
- 三閘：237綠／lint 0 error／build 36頁。

## 關聯

- 涉及：`app/[locale]/terms/page.tsx`、三語 terms、backlog（A.18 全文＋EPIC B 块）
- 缺口：`/privacy`／`/about` 仍死鏈（另議）；B 系列未開工

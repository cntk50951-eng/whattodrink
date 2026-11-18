# 2026-11-18 / D.12 推送覆蓋重新核實

## 情境
用戶指出「完全覆蓋」與舊 iOS memory 列出的缺19項矛盾，要求修正；品牌及前台通知需求仍須完成。

## 問題／原因
舊盤點只在頂部追加更新、正文仍稱後端缺發送。新 outbox 已有真 producer，不都在 send.ts；但21種 kind 也不證明22情境全通過。源碼復查找到 DEF-20261118-001 的邊界問題。

## 修正／約束
本輪逐項追 API 寫入→trigger→queue→FCM→Android 路由；補真缺口及現況矩陣。Supabase request482 HTTP200是空批次，cron成功僅證明配置；實際 provider／22情境真機未驗。既有 iOS APNs不遷移；不操作手機、不讀 Secret；AOS不自動提交。

## 本輪結果
- web build成功；完整工作樹131檔／1328 tests綠，lint 0 errors／12既有warnings。精準提交快照130檔／1321 tests綠、139頁webpack build成功、lint 0 errors／12 warnings；原工作樹Turbopack build亦成功。部署SHA待發佈核對後補。
- 四個web邊界與兩個Android路由／品牌修正完成，詳見matrix。iOS舊清單已改成明確APNs平台範圍。沒有新schema；可選唯讀push-coverage-readiness查5個trigger，既有0077／job6不用重跑。
- 工具教訓：深層route測試用os.path.relpath核對匯入深度；初次新增回歸3項確實失敗、修正後通過；不能只跑payload解析就稱業務來源覆蓋。
- 真機樣式／FCM有事件送達／點擊未驗；AOS保持Fixing／WIP，不裝機或提交。原手機及他人WIP未觸碰；臨時檔發佈核對後精確清理。

- 快照建置教訓：Turbopack拒絕指向快照根目錄以外的node_modules symlink；改官方webpack模式。快照不複製.env，使用明示虛構的build.invalid及build-only-placeholder通過既有env guard；不讀後端私鑰或正式DB。

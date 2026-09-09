# 2026-09-09 UR4.1 fix v4/v5 榜留地圖＋錄音 crash 真因

## 情境
- 用戶：榜的瀏覽操作要留在地圖上，不要跳新頁；另報三件事：錄音播不出（`MISSING_MESSAGE: camera.rerecord`）、發布窗退不出、發布窗圖標（😎／🎙／播放鈕）太土。

## 問題與原因
1. v3 榜行點了進 `/wall/[id]`——違背「榜是地圖的一部分」。
2. 錄音播不出真因不是播放器，是 `camera.rerecord` 缺 key：next-intl 抛錯炸掉整棵 CameraFlow，錄音 UI 根本掛不上去。審計（提 t("…") 字面＋三元內字面 vs messages）確認三語唯一缺口就是它。
3. review 全屏 overlay（`fixed inset-0 z-[1200]`）無任何退出；成功頁只有「再來一張」無回家路。
4. 發布頭像直接放大 `MOCK_ME.avatarEmoji`（😎 text-3xl）、VoicePlayer 無源回退用 🎙 emoji、錄音 done 播放鈕是素黑圓——三者都脫離塗鴉語言。

## 修正
- 榜下拉內列表／詳情雙視圖（`detailId` state，詳情 panel 展寬 w-72＋`max-h-[46vh]` 滾動）；檢舉／自刪後離榜退回列表；`/wall` 只剩看全部＋分享落地。
- `VoicePlayer` 加 `small` 檔（8 按鈕＋16 波形柱），榜詳情復用同一顆。
- 三語補 `rerecord`／`closeReview`／`backHome`；X 鈕接既有 `restart()`（停流清稿回 intro）；成功頁主按鈕回家（`router.push("/")`，本專案 localePrefix never，幹淨 URL）。
- 頭像→UserRound 手繪徽章（border-2＋accent＋硬陰影）；播放鈕同款塗鴉化；🎙→Mic。
- 門：123 綠／tsc 淨／lint 0 error（3 warning 皆舊檔）。

## 教訓
- 加任何 `t("新key")` 當下就要補三語；MISSING_MESSAGE 不是缺文案，是整頁 crash——以後加 key 後跑一遍上面的審計 one-liner。
- 全屏 overlay 出現的同一 commit 必須有顯式退出（X／返回），成功終態必須有回家路。
- emoji 不進 composer／播放器視覺層（mock 數據層的 avatarEmoji 除外）；頭像展示用徽章＋lucide。

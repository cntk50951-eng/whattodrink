# 2026-09-09 UR4.1 fix 相機黑屏＋錄音播不出（v1 回歸）

## 情境
- 用戶回報：相機權限開了但拍照頁全黑（v1 正常）；錄音無法播放。

## 問題
1. 黑屏：`?auto=1` 的 auto-begin 在 dev StrictMode double-mount（refs 保留）／連點下開兩個 getUserMedia 流；後到的 `toLive` 停掉先到的 track，而 `<video>` 掛的正是先到的，且 attach effect 因 phase 同值不重跑——有權限、有流、畫面黑。
2. 錄音：composer 播放鏈靜態無斷點；真正的結構性死路是「播不出的徽章」——種子 `audioSeconds` 無對應音頻、reload 後自有貼文也無（audio 只活內存 Map），秒數章點了沒反應＝報修。

## 原因
1. auto 是 v1 之後新加的唯一入口改動；v1 單次手點無 race。
2. mock 誠實口徑做到一半：只說 reload 即失，沒給後路。

## 修正
- 黑屏三閘：`autoBegan` ref（擋 double-mount 第二次）＋`reqGen` 世代計數（舊決議殺自己流）＋`toLive` 內 video 已在即重綁（堵 attach-effect-bail 缺口）。
- 錄音：種子 `audioSeconds` 全歸 null（L1 式教訓：不完整的證據不如不放）；`WallPost.audioDataUrl`（`fitAudioDataUrl` 400KB cap＋單測）＋submit 異步存＋`saveMyPosts` 配額退化（先丟語音保照片文字）＋`VoicePlayer` 回退鏈（會話 URL→dataURL→秒數章）；parse 舊數據預設 null。
- 門：120→123 tests／tsc 淨／lint 0 error（3 舊 warning）。9b：photo-mood 第三節補 audioDataUrl 一行？——已在表內原則覆蓋，未另加行（表寫的是 audio_url 未來列；本次不改表）。

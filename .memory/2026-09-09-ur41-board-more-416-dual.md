# 2026-09-09 UR4.1 v7 榜去跳轉＋牆語音 416 雙兇手

## 情境
- 用戶三報：①榜「看全部」跳單獨頁（要下拉內下滑加載＋點預覽留地圖）；②牆頁語音播不出，`GET blob:… net::ERR_REQUEST_RANGE_NOT_SATISFIABLE`；③榜詳情除照片還要文字＋錄音。

## 問題與原因
1. v4 榜底留了 `/wall` 看全部 Link——違「榜操作留地圖」。
2. 416＝空內容 range 讀不到，有兩條生產線：
   a. v5 空包已落盤：0-byte blob 存成 `data:audio/…;base64,`（逗號後無 payload），會話 URL 和持久 URL 雙雙是空的，播必 416——用戶牆上那條正是 v5 時代錄的，composer 新錄（v6）能播是另一條。
   b. 已發表 URL 被 composer 牽連 revoke：`clearAudio`（重錄／再來一張）revoke 掉 `audio.url`，而 submit 把同一條 URL 登記給牆——發完再錄一條，牆上那條即死。
3. ③經查是誤會一半：v4 詳情已有照片＋作者＋正文＋語音＋讚＋檢舉；用戶看不到是因為②的播放器 416＋可能舊包未重載。另正文只有 note，轉錄文字沒露。

## 修正
- 榜：刪看全部 Link，改下拉內「載入更多」（初顯 3＋每次 5，面板 `max-h-[46vh]` 內滾動；`loadMore` 三語）；`/wall` 路由保留。
- 416：`parseWallPost` 中和空包字符串（`isEmptyAudioDataUrl`，秒數＋URL 雙歸 null；null 檔不動，會話 URL 帖不受影響）＋submit 空包守衛（`audioBlob.size > 0` 才算錄過）＋`ownPostAudioUrl`（牆自有 object URL，跟 composer 脫鉤）＋`VoicePlayer` onError 降級鏈（會話→持久→秒數章，`key={url}` 保證切源重掛，postId 切換 microtask 重置）。
- 榜詳情加轉錄行（`voiceTranscript` 現成 key，有才顯示）。
- 門：131 綠（18 檔，posts 新 4 測）／tsc 淨／lint 0 error。新 lint error 一個（PostDetail effect 內同步 set）沿 v3 口徑包 microtask 解。

## 教訓
- 416 先問「內容是不是空的」，再問「URL 是不是死的」——這次兩個答案都是 yes。
- object URL 跨組件共用即埋 revoke 牽連：誰消費誰擁有（ownPostAudioUrl），生產者隨便 revoke。
- 播放器是最後一道防線：onError 降級鏈以後寫播放器就帶上，不給死按鈕。
- 用戶說「看不到 X」先核代碼有沒有（v4 已有），再解釋是被上游 bug 蓋住，不要急著重做一遍。

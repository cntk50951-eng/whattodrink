# 2026-11-25 / 訪客看公開主頁＋遇見按暱稱找人（openapi 1.70.0）

- 來源：iOS 上線前團隊反饋 DEF-20261125-005／017。
- 訪客主頁：`profileOf(viewerId: string | null)`；訪客只在對方 `mode=public` 放行，陌生人視角（`visibleRowsFor` 用空字串 viewer＝只見 public；座標仍只給本人）。不存在仍 404（UUID 不可枚舉，未統一成 401）。
- 遇見暱稱：模型輸出不可信 → `meetNicknameKeyword` 清洗；ilike 要轉義 `%` `_` `\`（PostgREST 的 `*` 也是萬用字元，暱稱含 `*` 只會放寬匹配，可接受）。
- 教訓：給 `MeetCriteria` 加欄位時，客戶端若用定長 struct／data class 解碼會靜默丟掉新欄位，且「只有新欄位」的計劃會被當空條件 —— 加 criteria 欄位必須同步客戶端（iOS 已加；AOS 記在 AOS memory 待跟進）。
- `eslint-disable no-control-regex` 對 `\u0000` 轉義寫法不需要，留著會多一條 unused-directive 警告。

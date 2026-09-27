# 2026-09-27 — E.1 相機 Sheet 實作完

## 做了什麼（待驗收未提交）
- `components/v2/V2CameraSheet.tsx`（新，三段式 ask→live→review）：權限門（consent 記憶＋`classifyGetUserMediaError` 引導）＋後置默認（`ideal: environment`）＋canvas 烘焙＋文字＋語音 mini 錄製（≤60s，內聯 v2 樣式，不複用 v1 doodle 風 VoiceRecorder）＋關 Sheet 停流。
- `lib/photoFilters.ts`（新，4 單測）：6 款＋美顏串＋`fitPhotoSize`（≤1024）。
- `WantRecord` 加三件套＋解析白名單（超長圖擋、note 截 500、壞語音丟）＋4 單測；`dropWant` 雙分支併入；自家卡顯真圖文音；TabBar 拍照改開 Sheet。
- i18n：21 cam key ×三語（v2 ns）。
- 三閘：lint 淨／350 綠／build 綠。

## 坑＋決策
- v6 `set-state-in-effect` 會穿透函數調用（beginSession 間接調用仍被 flag）——開門重置用 disable＋註記（沿 ChatThread 口徑），事件側設值優先。
- Sheet 嵌套手滑：stack `</Sheet>` 誤刪過一次，靠 tsc 抓回。以後改 Sheet 尾巴先數開合。
- i18n 用 python json 改——确认原文件 2 空格縮進，diff 乾淨；但工作樹 messages 本來就有隊友的未提交改動（chatRoomFailed 等），原樣保留，提交時對。
- 誠實命名：美顏開關＝亮度對比飽和，非磨皮；E.2（POST＋pins＋他人卡，碰 C.10，需協調）已建檔置 []。

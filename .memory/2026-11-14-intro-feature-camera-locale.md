# 介紹頁補圖、鏡頭節奏與繁體 cookie 修復

## 情境
用戶指出 `/intro-next` 沒有酒局／足跡／遇見／今晚喝什麼／碰杯／主頁圖片，並批評動畫比原版平淡；追加「繁體無法點擊」。沿 UR M.1、另立 UR M.2／DEF-20261114-001。

## 問題與原因
前版只完成照片與 Ivy，其他功能漏圖。全幕固定文字左、手機右及小幅浮動，沒有原版的鏡頭層次。繁體語言入口沿普通導航的裸路徑，next-intl 讀取舊 NEXT_LOCALE=en 時 307 回英文；不是按鈕不能接收點擊。

## 修正
- 只改本地 intro-next，8 新畫面補為 16×3＝48 張；酒局列表→詳情，其餘六功能皆有獨立鏡頭，另含主地圖及個人主頁避免「主頁」歧義。繼續照片發布第一、Ivy 第二，不覆蓋原 intro，不部署。
- 看原版 SceneView 的左右 flip、透視進場與 zoom，查 Remotion interpolate／spring 官方文件；採完整畫面→推近實際操作→平移→拉回，不採只放大浮動。文字逐段進場，手機倍率上限 1.32、桌面 1.6；鏡頭純函數測試涵蓋前後文恢復、左右對稱、手機邊界。
- 三語入口皆明確前綴，獨立 introLanguageHref；原生 a 走既有 proxy 先種 locale cookie，再正規化默認繁體裸 URL。12 路 HTTP cookie／翻譯／圖片回歸＋實際英文頁點繁成功；不改全站 proxy。
- 固定按鈕從 iOS xcstrings；新 NightTrailJournal 部分直接以中文字作 key，同樣有三語。snapshot 擷取必須含 header 轉傳及動態 profile.tab.* key，不能只用正則掃 t 字面呼叫。
- resvg 彩色 emoji 可能令整句 fallback 成方框；碰杯裝飾 emoji 改成向量酒杯＋原文。printf 百分比 %% 需轉單個 %；英文 wrap 按單字，不能逐字母切。

## 驗證
Build 132 頁；全量 115 檔／1,195 tests 通過，lint 0 errors／12 個既有 warnings；桌面及手機版視覺初查、繁體實際點擊和預覽 16 figure 通過。48 成品重建後重驗雜湊。用戶仍須親驗；不 commit／push。原版／首頁／proxy 無 diff。測試 HTML、iOS 均唯讀。只清本輪 `/tmp/wtd-intro-features-en.png`／`-hant.png`，未動其他工作檔。

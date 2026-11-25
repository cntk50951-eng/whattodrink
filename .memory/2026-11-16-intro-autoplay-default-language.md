# Intro 自動播放：不要讓無聲動畫等待音訊權限

## 情境
用戶在最新版 intro 發現首次／刷新不播放、裸 /intro 會轉英文，並要求品牌 slogan 表達喝酒、分享、交友樂趣與 AI 懂口味。沿 UR M.9，登記 DEF-20261116-001／002；工作區另有 M.8 文案／邊緣／換幕／metadata，保留並避開覆蓋。

## 問題
普通 /intro（沒有凍結參數）標示播放中，Remotion useCurrentFrame 實際停在 0，整個首屏內容未入場。此前只驗 play 事件不足以確認畫面在動。舊 ?t=2.8 又隱式凍結，令用戶刷新仍不能自播。

## 原因
- 本機已裝 Player 的 usePlayback 會在未靜音時等待 getIsResumingAudioContext，無手勢的 resume 可長期懸置；介紹只有圖片／CSS，卻使用預設未靜音及五個共享音訊標籤。靜音修復前 DOM --orbit 一直 0deg，修復後可持續增加至其他場景。
- next-intl 原先以 cookie／Accept-Language 協商；實測 NEXT_LOCALE=en／zh-Hans 時裸 /intro 被導向相應前綴。defaultLocale=zh-Hant 並不代表每次裸入口都繁體。

## 修正
- 查 Remotion 官方 autoplay／Player initiallyMuted、numberOfSharedAudioTags 文件與本機實作；Player initiallyMuted、共享音訊標籤 0，initializePlayback 先 mute。普通 t 連結定位後繼續播放，只有 preview=1 明確凍結；減少動態與預載前已鍵盤閱讀仍保持暫停，無強制重播計時器。
- introRouting 沿全站 routing 複製並關 localeDetection，只給 intro／intro-next／圖庫（含明確三語前綴）；原版備份與 /v2 等仍走原協商，封站先行順序不變。只新增 i18n policy 與 proxy 專屬選擇，不改全站 defaultLocale。
- slogan 三語同步：繁「分享一杯，遇見同好 · AI 更懂你的口味」；簡「分享一杯，遇见同好 · AI 更懂你的口味」；英「Share a drink. Find your people. AI knows your taste.」。沒有重寫 M.8 其他文案。
- 新增播放初始化四項回歸，模擬未靜音無法進幀、第一次／刷新、舊時間連結、明確預覽與閱讀／減少動態；locale policy 三項單測。next-intl 原生 ESM 在無設定的 Vitest 內載入 next/server 出現副檔名解析錯，沒有為此擴改全域 runner；保留 policy 單測，真實框架協商改由 HTTP 16 路驗證（12 預設／2 明確語言／2 App 與備份）。
- 瀏覽器以實際 DOM 動態樣式與畫面判斷進幀，不只看播放圖示；普通網址、刷新、t 連結、明確靜態預覽／手動恢復及英文入口已核對。英文 slogan 在 1280 寬時品牌與操作列有足夠間距。預覽的既有分頁曾停在 localhost refused 的資料錯誤頁，沿同一瀏覽器建立新 localhost 分頁排查，沒有繞過 URL 安全限制；最終交付普通 /intro 入口。
- build 138 頁；全量 122 檔／1,258 tests；全站 lint 0 errors／12 個既有 warnings。M.8 的 metadataBase 警告保持原狀，不屬本輪故障。CHANGELOG、DEFECTS、UR M.9、docs/data/intro-marketing.md 及文案指南同步；未提交／推送，保持正式站封站。
- 截圖交付 `intro-slogan-autoplay-fix.jpg` 留在既有 visualizations 工作目錄；本輪沒有暫存檔殘留。自動瀏覽器除錯不代替用戶親眼驗收。

參考：https://www.remotion.dev/docs/player/autoplay 、https://www.remotion.dev/docs/player/player#initiallymuted 、https://next-intl.dev/docs/routing/middleware 。

# 已發布的三語 intro

2026-11-16 發布批次（M.5／M.6／M.7）：用戶授權提交部署本地最新版，包含品牌首屏、三語文案、照片編輯→地圖故事、Ivy→大話骰→調酒，以及底部去連結／手動回看。Production 仍沿 SITE_LIVE 封站控制；發布完成與來源版本請以 GitHub main 的 Vercel Production 狀態為準。

2026-11-15 本地更新：首屏使用 `hi drink／嗨飲` 品牌主視覺，成品、來源與重建方式見 `brand/README.md`；原圖示／字標沿 iOS 品牌稿，66 張功能圖片不變。後續敘事以 `story.tsx`／`docs/intro-copywriting.md` 為準（編輯直接接地圖，Ivy 後接大話骰）。

2026-11-14：用戶授權將新版接到 `/intro`（繁體）、`/zh-Hans/intro`（簡體）、`/en/intro`（英文）；`/intro-next` 保留預覽。原版已備份為 `/intro-backup`，原 components／shots 與 Git 標籤保留。

網頁三語文案直接修改 `components/intro-next/copy.json`；欄位與故事順序見 `docs/intro-copywriting.md`。本輪未改寫文字或圖片。以下為歷次本地製作與驗證記錄，其中「不提交／部署」「不改原 intro」是當時限制，已由本輪明確發布授權更新。

# UR M.1 · 三語產品宣傳圖片與流程

本地獨立對比頁：`/intro-next`。原版 `/intro`、首頁、v1／v2、iOS 和遠端均不修改。

## 圖片組與觀看方式

- `artwork/zh-Hant/`：繁體中文 22 張
- `artwork/zh-Hans/`：簡體中文 22 張
- `artwork/en/`：英文 22 張
- `feature-overview.png` 是新增八個畫面的繁體聯絡表，供快速比較，不計入每套 22 張。
- 每張 1170×2532，WebP；`artwork/manifest.json` 記錄完整組、尺寸、雜湊及所用 iOS UI key。
- `/intro-next/artwork`、`/zh-Hans/intro-next/artwork`、`/en/intro-next/artwork` 可逐張放大核對。

| 順序 | 成品檔名（每語言同名） | 真實功能依據 | 宣傳整理 |
| --- | --- | --- | --- |
| 1–5 | `camera`／`editor`／`preview`／`map`／`detail` | IMG_9295–9297；CameraPageView、PhotoEditorPanels、NightCheckinPublishStep、NightPostDetailView | 同一照片串起拍照→編輯→預覽→發布→地圖／詳情 |
| 6 | `ivy-bar` | IMG_9298；Bar 視圖 | 保留實際 Ivy 角色、聊天與遊戲入口 |
| 7 | `cocktail-book` | HTML TC-CKT-01-01 步驟 2 | 用實際 Gin Fizz 卡、99 款目錄與原生向量插畫重構 |
| 8 | `cocktail-recipe` | TC-CKT-02-01 企圖進配方但畫面仍在首頁；依 NightCocktailRecipeView 補足 | 真實 0.5／1／2／4 杯與 mL／oz；45 mL 金酒、30 mL 檸檬汁、10 mL 糖漿、梳打水加滿 |
| 9 | `cocktail-step` | TC-CKT-03-01 受阻，未到內頁；依 NightCocktailStepsView、CocktailSteps.make、stepArt.shake 補足 | 真實第 5／8 步、12 秒搖勻、Ivy 預寫提示、問 Ivy 及每問扣額度提示 |
| 10 | `cocktail-done` | NightCocktailDoneView | 完成→影相發貼文／再整一杯，沿實際 UI 文案 |
| 11–12 | `dice-cups`／`dice-peek` | IMG_9299／9300；BarDiceView | 保留原 3D 骰盅／骰子區，所有 UI 三語重排 |
| 13–14 | `party`／`party-detail` | IMG_9302／9304／9305；NightPartyBoardView／NightPartyDetailView | 篩選→酒局詳情；示範 Amber Room、21:00、尚餘兩席 |
| 15 | `trail` | IMG_9314；HTML TC-TRAIL-02-01；NightTrailJournalView | 日期、週記錄、照片、地點、回放入口 |
| 16 | `trail-map` | HTML TC-TRAIL-04-01 步驟 3；TrailMapView | 清理測試站點／地圖，設計 4 站預覽、目前站卡、範圍選擇與播放控制 |
| 17 | `trail-replay` | 用戶附件 IMG_9315；TrailMapView／FootprintCanvas | 依時間揭示站點、腳印路徑、暫停／站點跳轉／速度；以香港小範圍示意路徑替代測試跨境長線 |
| 18 | `meet` | IMG_9301；NightMeetFlowView | 描述→理解的條件→匹配原因／加好友／聊天 |
| 19 | `tonight` | IMG_9312；DrinkRevealView | 真實雞尾酒類別及附近／再抽／約人入口 |
| 20 | `cheers` | NightActivityView cheersBody／cheersActions | 收到／送出、按人／時間線、回敬／聊天 |
| 21–22 | `home`／`profile` | IMG_9295／9306／9307；NightHomeOverlay／NightProfileView | 主地圖及個人主頁的真實功能區 |

新調酒／地圖足跡六張加 `-v4.webp`，其他維持 `-v3.webp`；三語同名。新檔名避免本地 Next 圖片優化器沿用製作中的舊畫面。
主故事先完成 1–5 的照片發布流程，再播 Ivy 酒吧→整一杯完整流程→大話骰，接著是酒局、足跡記錄→地圖預覽→腳印回放及其他功能。兩個主打功能在首屏明說，照片帖子在手機前景；沒有底部影片時間軸，保留自動循環、頂部暫停與減少動態模式。

## 固定 UI 原文與示範內容的界線

`ios-ui-copy.json` 主要是從 `whattodrink_ios/WhatToDrink/Localizable.xcstrings` 擷取的三語固定文案快照（`intro.trail.*` 的 Swift 原文／本輪翻譯例外見下方來源說明）；`scripts/render-intro-artwork.mjs` 以 key 取值排字，沒有用生成模型翻譯／畫中文字。格式參數（例如每人 5 粒骰）依真實格式填入。

照片、帖子文字、暱稱與中環地點是宣傳示範，非真實用戶帖子／即時定位。地圖簡化為示意底圖，非導航地圖。頁腳三語如實標示「依實際功能設計 · 示範內容」。

`captures/` 保留原始參考 PNG 與 SHA-256；它們不是最後的宣傳成品。使用者提供的圖片和測試工程均未覆寫。指定 E2E HTML 的多條照片用例停在模式／編輯器，因此以實際 Swift 視圖補足正確發布介面；沒有聲稱報告已驗證發布成功。

## 可重建方式

執行 `node scripts/render-intro-artwork.mjs`。使用專案現有 `@resvg/resvg-js` 與 Next 的 `sharp`，無網絡、無 API、無生產數據。母版是腳本中的 SVG 版面，避免為 66 張圖片重複保存大型嵌圖 SVG。字體用系統 PingFang／Heiti；有英文自適應排字。UI 先以不透明底層去除原語言，避免英文對局裡透出舊中文。

## 圖像來源與提示詞

**內建 imagegen**，沒有用 CLI/API fallback。供頁面使用的兩個母圖均已複製到 `source-art/`。

### `source-art/highball.png`

本聊天前一版生成的夜間攝影，這次重新用於真實功能的照片區，不沿用舊虛構 UI。

Final prompt:

Use case: ads-marketing. Asset type: original editorial cocktail photograph for WhatToDrink, a Hong Kong nightlife discovery and social app. Primary request: premium photographic visual to replace a blurry test photo inside a camera/check-in app demonstration. A single beautiful amber highball cocktail with one large perfectly clear ice spear and a delicate grapefruit peel, fine condensation, on a dark polished bar counter in a sophisticated intimate Hong Kong cocktail bar after dark. Background has warm amber practical lights, a very subtle cool cyan neon reflection and beautifully defocused city-night bokeh. Close editorial still life, glass in the center, generous atmosphere above, vertical 2:3 composition, fully visible glass, rich near-black shadows, realistic optical depth of field, tactile glass and ice, cinematic but natural, appetizing and sophisticated. No people, no hands, no logos, no legible signs, no brand labels, no typography, no UI, no phone frame, no watermark. The image will be used as a fictional promotional check-in photo rather than evidence of a real venue. Save the result as a local file and include its path if supported.

### `source-art/ivy-bar.png`

參考／編輯目標：使用者附件 IMG_9298.PNG。

Final prompt:

Use case: precise-object-edit / UI supporting artwork. Edit target: this actual screenshot of the WhatToDrink app's 3D bartender Ivy and her bar. Produce a clean 2:3 vertical background plate for a multilingual promotional reconstruction of the SAME real app. Remove all UI text, controls, status bar, chat bubble, badges, buttons, microphone, joystick and menu overlays. Reconstruct only the small obscured bar regions naturally. Keep the SAME recognizable Ivy face, asymmetrical short dark bob, bow tie, shirt and waistcoat, the SAME stylized in-app 3D rendering aesthetic, same warm bottle shelves and bar counter, same pose. Do not glamorize or change her design; no photorealistic human replacement, no different venue or extravagant extra props. Improve clarity and warm amber lighting subtly, with natural crisp edges and less screenshot haze, maintaining a faithful game render. Ivy centered, face near upper 38 percent of the portrait, torso visible, bar counter across lower part, some room above for a real app header. NO WORDS, no letters, no logos, no UI, no watermark. This is supporting scene art, not a final UI screen; exact localized interface text will be laid out separately by code.

## 2026-11-14 鏡頭修訂與語言修復

每幕以完整畫面建立語境，左右交替進場、透視由遠至近，推近實際操作區、平移到下一個畫面，再於切幕前拉回。重點文字分段出場；手機縮小鏡頭位移與倍率，保留減少動態模式。取代單一浮動手機＋常駐放大卡片。鏡頭按 Remotion 官方幀插值／easing API 實作，無新依賴：<https://www.remotion.dev/docs/interpolate>、<https://www.remotion.dev/docs/spring>；原 `/intro` 的左右換位／透視／zoom 為本地比較基準。

三語入口（包括繁體）使用明確 locale 前綴與原生連結，讓 next-intl 更新 NEXT_LOCALE cookie；繁體再由既有 proxy 正規化回不帶前綴 URL。不改全站路由。英文／簡中 cookie 各測三語、故事／預覽兩頁共 12 路均正確；實際瀏覽器點擊英文頁「繁」亦切換成功。

SVG 不依賴彩色 emoji 字型；碰杯的裝飾表情改由相同意義的向量酒杯搭配原文呈現，避免整行字體缺字。百分比遵照 printf 的 %%→% 規則。英文依單字換行，避免半個單字斷在兩行。

## 2026-11-14 調酒與地圖足跡新增來源

`references/manifest.json` 保留報告三張原始 JPEG 與 IMG_9315 原始 PNG 的 SHA-256。報告「跟住做」使用 `TC-CKT-*` 命名；`TC-CKT-02-01`／`03-01` 受阻，截圖仍在酒譜首頁，不把它們描述為測試已跑通配方或完成分享。內頁由現有 Swift 實作重構。

`source-art/gin-fizz.json` 是 App `Resources/Cocktails/cocktails.json` 的最小資料快照（Gin Fizz 原配方／材料三語名／原插畫／搖勻步驟插畫），沒有新畫另一款不相符的酒。第 5／8 步由現有 `CocktailSteps.make` 的順序確認：準備、三次量取、搖勻、隔冰倒入、加梳打、裝飾。不是直播或影片教學畫面的宣稱。

調酒固定 UI 逐字取 xcstrings。足跡回放部分標籤是 Swift 寫死繁體，未收進 xcstrings；新增的 `intro.trail.*` 含三個 Swift 標籤／格式鍵及一個地區示例鍵，簡中／英文由本輪翻譯，來源逐鍵記於 `ui-copy-provenance.json`。地圖是有意標示的香港示意，腳印保持在陸地、無真實用戶路線或定位。預覽展示 4 站，回放到第 3 站，與原足跡示例 3 晚／4 打卡一致。

`cocktail-trail-overview.png` 為新增六個畫面的繁體聯絡表。新圖在圖片預覽內可用 `#cocktail-book`、`#trail-map` 直接定位。

## 2026-11-14 自然動態敘事修訂

三語介紹的「發布照片 / 01」等序號及圖片預覽標題編號已移除；素材表仍以順序列號方便維護，App 內真實步驟與時間不改。沿原 66 張素材，無需重新生成圖片。

鏡頭使用五次平順曲線控制推近／拉回，在頁面交接前略退焦，再平順移到新操作區。縮放沿 Remotion 已安裝版本的 `interpolate(..., {output: 'perceptual-scale'})` 處理感知面積；固定中心加仿射平移取代同時移動 transform-origin，避免畫面漂移。桌面上限 1.5、手機 1.24，並驗證縮放後圖片持續覆蓋窗口。參考官方 API：<https://www.remotion.dev/docs/interpolate>。

場景分別採 glide／arc／lift 路徑，頁面交接使用 slide／lift／dissolve。新頁未全顯示前始終保留不透明舊頁，避免黑閃；光暈以獨立較慢曲線變化，縮放幅度僅 6%，對焦換頁不觸發亮度脈衝。文字逐行展開，原流程短語隨畫面依次強調，不加播放器式底部進度條。全部動態由影格決定，暫停／?t=／減少動態沿既有控制。

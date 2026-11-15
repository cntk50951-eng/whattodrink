# UR M.1／M.4 · 三語介紹頁（`/intro`／`/intro-next`）

第一主線：發布照片；第二主線：與 Ivy 玩大話骰。原版保留於 `/intro-backup` 及 Git 標籤 `backup/intro-2026-11-14`；v1／v2、iOS、全站開關與 API 不變。

| 頁面位置 | 類型 | 當前來源 | 未來表映射 |
| --- | --- | --- | --- |
| 開場／四步發帖流程／Ivy 酒吧、跟著調酒與大話骰／酒局、足跡、遇見、抽選、碰杯、主地圖與個人主頁／結尾 | `IntroCopy`／`Scene[]` | `components/intro-next/copy.json` 三語可編輯文案（`copy.ts` 提供型別及路徑）、`story.tsx` 的幀時間軸、每幕 glide／arc／lift 鏡頭與 slide／lift／dissolve 換頁；`motion.ts` 依頁面切換時點計算退焦／推近、仿射平移、獨立柔光與文案重點；同一頁包含多個操作時用 phraseTimes 對齊文字與實際畫面。三語介紹及預覽標題不含序號；發帖流程先播 | 不進庫 |
| 三套圖片：照片流程、Ivy、酒譜／配方／跟做／完成、酒局列表／詳情、足跡記錄／地圖預覽／回放、遇見、抽選、碰杯、主地圖、個人主頁 | `ArtworkId`／66 張 1170×2532 WebP | `artwork.ts` 按 locale 選圖；`public/intro-next/artwork/{zh-Hant,zh-Hans,en}/`；生成腳本 `scripts/render-intro-artwork.mjs` | 不進庫；宣傳重構，不是線上真實帖子 |
| 圖片內固定 UI 文案 | `Record<key, Record<locale,string>>` | `public/intro-next/ios-ui-copy.json`，逐字取自 iOS `WhatToDrink/Localizable.xcstrings`；三個 `intro.trail.*` 標籤鍵取自 TrailMapView 的硬編碼繁體並翻譯簡中／英文，另有一個地區示例鍵，逐鍵來源見 `ui-copy-provenance.json` | 不進庫；不修改 iOS 語言檔 |
| 照片、暱稱、帖子文字、地點示意 | 靜態示範內容 | 生成腳本三語 demo 物件＋高球照片；Amber Room 酒吧、海岸筆記／城間小酌人物、3 晚／4 打卡／2 好友／3 收藏及 86% 匹配均為離線示範；地圖為簡化示意，無精確用戶座標；沒有測試隨機字串或筆電照片 | 不進庫；不建立假用戶、假互動或假地點 |
| 調酒原配方／插畫／步驟 | 最小 iOS JSON 快照 | `source-art/gin-fizz.json`，原 App 99 款目錄中的 Gin Fizz、4 樣材料、原生向量層與搖勻步驟插畫；`CocktailSteps.make` 第 5／8 步，無直播／影片能力宣稱 | 不進庫；不修改真實配方 |
| 地圖足跡預覽／回放 | 離線示範站點／腳印 | `intro-cocktail-trail-artwork.mjs`，原 TrailMapView 結構與 FootprintCanvas 幾何；示意 4 站／近 7 天 3／選中晚 2、目前第 3 站，無真實座標或路線 | 不進庫；不作導航資料 |
| 調酒與足跡測試依據 | 原始 JPEG／PNG＋來源 manifest | `references/`：TC-CKT-01 步驟 2、TC-CKT-02 步驟 3、TC-TRAIL-04 步驟 3 及 IMG_9315；配方／跟做測試受阻的限制明記，沒有把宣傳重構當測試成功證據 | 不進庫 |
| 攝影／Ivy 場景底圖 | 生成素材 | `public/intro-next/source-art/`，內建 imagegen 生成／依原實機角色編輯；提示詞見同目錄上層 README | 不進庫 |
| 大話骰中央 3D 場景 | 原截圖圖層 | `captures/ivy-dice-cups.png`／`ivy-dice-peek.png`；骰盅及骰子保留實機畫面，所有 UI 區域以對應語言原文重構 | 不進庫 |
| 原實機參考圖 | PNG＋SHA-256 manifest | `public/intro-next/captures/`，取自用戶附件及 E2E 報告原附件；完整保留供核對，不直接當最終宣傳圖片 | 不進庫 |
| 網頁語言 | `AppLocale` | locale route 參數＋三語入口全部明確 locale 前綴，沿現有 proxy 更新 NEXT_LOCALE cookie；切換語言時文案與圖片同步 | 不新增持久化；沿既有 cookie |
| 播放／暫停／尺寸／圖片就緒 | React state／Remotion ref 與事件／有界預載佇列 | 當前頁面會話；優先載入 Ivy／照片詳情／相機三張開場圖，最多等 1.8 秒即放行；其餘每批 2 張低優先預載，單張 8 秒逾時後繼續，離頁／換語言清理計時器與回呼。播放器掛載完成才初始化並啟用控制，手動 toggle 傳入點擊事件。所有動態由 Remotion 影格推導；自動循環、無底部進度條；減少動態偏好則停在結尾，頂部可主動播放 | 不進庫；不新增 localStorage |
| `?t=<秒>` 凍結 | `number \| null` | URL，非法值忽略、有效值夾在合法影格 | 不進庫 |
| 三語圖片預覽 | 靜態頁 | `/intro/artwork`、`/intro-next/artwork` 及其 `/zh-Hans`／`/en` 路由，按同一 locale 顯示 22 張原尺寸圖，可開大圖 | 不進庫 |
| 原版備份／回復 | Git 標籤／原播放器／SHA-256 清單 | `/intro-backup` 使用不變的 `components/intro/` 與 `public/intro/`；`docs/intro-backup-2026-11-14.json` 記替換前 commit 及完整原素材雜湊，Git 標籤可回復原頁 | 不進庫 |
| 商店入口 | 靜態狀態 | 未有正式地址，三語明示即將推出 | 不進庫 |

頁腳明示「依實際功能設計 · 示範內容」及其三語版本。所有畫面為真實功能的宣傳重構；沒有讀取或改寫線上帖子／帳戶／遊戲。

# 介紹頁三語文案重寫：名詞要跟圖片內 App UI 對齊

## 情境
用戶要求先理解 intro 與 iOS App，再重新設計 `components/intro-next/copy.json` 三語文案（UR M.5）。

## 問題
舊文案多處和圖片內 App 字樣不一致：英文 Parties（App 是 Meetups／Join meetup）、Make a cocktail（App 是 Mix a Drink）、toast back（App 是 Cheers back）；簡體沿用「整一杯」，但簡體圖片是「调一杯」。文案也偏操作手冊（「按發布帖子」），缺產品定位。

## 原因
文案從 TypeScript 原樣抽出，翻譯時沒有對照 iOS `Localizable.xcstrings` 及 `public/intro-next/ios-ui-copy.json`（圖片實際用的 UI 字串）。

## 修正
- 寫文案前先查 `public/intro-next/ios-ui-copy.json`（圖片字樣）＋iOS `docs/NLS.md` 術語表；繁體標準書面語、簡體內地用語、英文英式拼寫。
- 結構硬約束：`detail` 以 `" → "` 分段且段數對應 phraseTimes／shots；`sub` 以 `\n` 分行；兩者都是 React key，不可重複。copy.test.ts 要求 hero.sub 含 Ivy、description 含 發帖／photo posts 與 大話骰／Liar’s Dice（英文用彎引號 ’）。改後用腳本對比 HEAD 的 keys／段數／行數。
- 宣稱前查代碼：Meet 搜索 people／places／parties／posts（`MeetSmartModels.swift`）；Ivy 記憶（`bar.memory.*`）；不提沒有圖片的功能（誰是臥底、碰一碰、熱點、誠信）。
- Remotion 故事是客戶端渲染，curl HTML 只能驗 `<title>`，正文要靠瀏覽器親驗。

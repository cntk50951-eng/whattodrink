# intro 文案潤色與截圖驗證的工具坑

## 情境
用戶要求三語文案潤色、檢視圖片動畫品味、確認 hi drink 品牌（UR M.8）。先經 advisor 設計關卡再開工。

## 問題
- 用截圖判斷品味時，多個工具坑讓第一輪結論不可靠。
## 原因與修正
- macOS 沒有 `timeout`：迴圈 `timeout 40 chrome …` 靜默失敗、沒產圖；別用，改順序執行。
- headless Chrome 版面寬度下限約 500px：用 `--window-size=390` 截圖會「裁切」而不是真手機版面；iframe 聯絡表也不行（頁面送 `X-Frame-Options: DENY`）。CDP 模擬 390 時播放器不前進（空舞台），手機寬度須由用戶目測，不可宣稱已驗。
- 清晰度要用 DPR 2（`--force-device-scale-factor=2`）判斷；DPR 1 的軟邊不代表圖片尺寸不足。
- 並行啟多個 headless Chrome 會互卡，順序執行；`?t=<秒>` 可凍結任意影格，換幕用 0.3 秒間隔取幀條才看得到疊影。
- 品牌圖外緣方邊來自素材自帶的邊界 alpha（最高 54／255），不是 CSS；窄帶線性遮罩可去邊且不傷圖示。
- 根 layout `<html lang="zh-Hant">` 固定，英文專屬 CSS 用 `.story[data-locale="en"]`，不要用 `:lang(en)`。
- 換幕疊影：`Frame` 進出同時淡化會讓舊標題被新手機蓋住且整體變暗；出場前 58%、入場自 40% 錯開即可，不用動 OVERLAP／時間軸。
- 文案事實以 iOS Localizable.xcstrings 為準；英文撇號用 ’；繁體用書面語（調而非整當動詞），簡體不是繁體轉字。

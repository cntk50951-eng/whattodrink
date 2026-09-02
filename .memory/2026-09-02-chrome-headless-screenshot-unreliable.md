# 2026-09-02: Chrome headless --screenshot 渲染不可靠，mobile 截圖假報 overflow

## 情境

寫完 marketing landing framework，用 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless --screenshot` 在 390x844 viewport 截圖，vision tool 回報「headline 被右邊裁切、description overflow」。

連續 4 次截圖（每次修一個 fix）都報同樣問題。即便：
- `min-w-0` 加到 Stack
- 字級縮到 `text-3xl`
- 加 `overflow-x-hidden` 到 body
- `text-balance` 換成 `break-words`
- 全部 h1/h2 都加 max-w constraints

視覺回報都說還在 overflow。

## 問題

後來改用 **playwright + chromium** 重新截圖並 evaluate JS 量 computed style：
- `documentElement.clientWidth: 390` ✓
- `body.clientWidth: 390` ✓
- `main.clientWidth: 390` ✓
- `h1.clientWidth: 322` ✓（h1 字寬 322px < container 358px，沒 overflow）
- `h1.scrollWidth: 322` ✓（scrollWidth 等於 clientWidth，沒內容溢出）
- `h1.fontSize: 30px` ✓
- `h1.wordBreak: normal`、`overflow-wrap: break-word` ✓

playwright 截圖也用 vision 看：**完全沒有 overflow**，所有文字完整可見，layout 正確。

**結論**：Chrome headless `--screenshot` flag 在 macOS 上對 CJK 字型與 layout 的渲染跟真實瀏覽器不同，產生假警報。

## 原因（推測）

- Chrome headless screenshot 路徑用了舊的 layout 計算，未觸發與 Chromium 相同的 text shaping
- macOS 字型 fallback 路徑在 headless mode 下跟正常 mode 不一樣
- 多次截圖拿到同樣錯誤結果，可排除偶發

## 修正

1. **流程改用 playwright**：`pip install playwright && python3 -m playwright install chromium`（已裝）
2. **寫 Python 腳本** evaluate JS 量 computed width，不靠 vision tool 一句話判斷
3. **chrome --screenshot 只作 fallback**：當 playwright 不可用時再用，且要把結果「可能是 headless render bug」列入考量
4. **不要只根據 vision tool 報的「看起來有 overflow」就改 code** — 一定要先用 playwright 量 computed style 確認問題存在

## 學習

- **vision tool 也會錯**：它分析圖片時也會把 headless render 缺陷當成 code 缺陷回報
- **真實瀏覽器渲染是 ground truth**：playwright 用 chromium，跟 Chrome 同 engine，比 headless --screenshot 可靠
- **不要 chase 假 bug**：連續 4 個 fix 都沒解決「問題」，是因為問題根本不存在

## 相關

- `.memory/2026-09-02-skipped-playwright-step-6.md` — 應執行 playwright 的根本原因
- `/tmp/whattodrink-debug.py` — 量 computed width 的 debug 腳本
- `/tmp/whattodrink-final-shots.py` — final playwright 截圖腳本

## 未保留的 fixes（no-op 但仍 best practice）

以下修改是「偽問題」驅動的，但其本身仍是好習慣，所以**保留**：
- 字級 `text-4xl` → `text-3xl` 在 mobile — 窄螢幕更穩
- `text-balance` → `break-words` — 對未知長度文字更 robust
- `min-w-0` 在 Stack — flex container 防 overflow 通用守則
- `overflow-x-hidden` 在 body — 兜底防意外

唯一**真的有改進**的：`<Button render={<a>} nativeButton={false}>` — 消掉 5 個 Base UI accessibility warning。

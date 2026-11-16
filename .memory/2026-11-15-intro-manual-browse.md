# 介紹頁：自動敘事與手動回看並存

## 情境
用戶指出 intro 底部不應有「查看全部畫面」等連結，並要求分析左右滑動回看設計，避免只能等動畫循環。沿 UR M.6，保留既有文案、地圖故事和 Ivy 後大話骰順序。

## 問題
原 Player 只有播放／暫停，stage pointer-events:none 無法滑動，亦無逐頁導航。固定秒數 seek 容易停在轉場中；只按功能切換又會漏掉調酒、足跡的頁內步驟。手動查看後若自動恢復，使用者仍沒有足夠閱讀時間。

## 原因
線性影片導覽只把時間當作索引，沒有把相同 SCENES／shots 轉成可尋址的畫面。Remotion seekTo 在播放狀態會自動恢復，必須先 pause；全屏 intro 和一般小型輪播的操作也要區分。

## 修正
- 比較固定快轉、純輪播與雙模式，採自動敘事＋使用者接管；W3C APG 的停止／前後控制及明確恢復原則作依據（https://www.w3.org/WAI/ARIA/apg/patterns/carousel/）。保留既有運鏡，無時間軸。
- buildBrowseStops 從同一場景和頁內切換推導 25 個位置，完整顯示後才停靠；同功能各頁可回看。前後箭頭、原生功能選單、方向鍵／Home／End 共用 pause→seek；手動後沒有恢復計時器。
- Pointer Events＋pan-y pinch-zoom，僅主指針中央水平手勢導航，保留 20px 邊緣；短拖／縱向不切換，取消只恢復原本被中斷的播放。鍵盤聚焦／控制列 hover 暫停，端點用 aria-disabled 保留焦點；預載期間已鍵盤聚焦亦不會在稍後自動開播。
- 底部原版／圖庫連結移除，留下示意與理性飲酒文字；三語 browse 文案、目前步驟計數及手動讀屏回報齊全。功能選單直接用三語 eyebrow，文案工作稿須同步說明。
- API 核對：Remotion PlayerRef seekTo、timeupdate／seeked（https://www.remotion.dev/docs/player/player）；MDN touch-action；本機 Next lazy-loading 指引。測試最初 screenAt 少傳 side／transition，build 型別檢查抓出後依現有六參數簽章補齊，重跑通過。
- 驗證：intro 10 檔／120 tests、build 138 頁、相關 lint 零錯／零警告。瀏覽器驗三語功能選擇／逐頁／暫停恢復、首尾及鍵盤；intro footer 連結 0，控制台無應用錯誤；390×844 與 1280×800 版面已看。Playwright 對 aria-disabled 按鈕不發 press，改用當前焦點的原生按鍵，確認 Home 後焦點仍留在前頁鍵、Right 可前進。
- CUA 沒有實機 touch 模擬，未宣稱已做手機手指端到端測試；手勢與取消決策有單測，實機由用戶親驗。沒有改全站封站／備份，未提交或推送。
- 保留預覽交付圖 `/Users/joannalee/.codex/visualizations/2026/11/14/01a1d8d4-e489-7bc0-aa80-35d24c833170/intro-manual-browsing.jpg`；臨時 viewport 已 reset，沒有本輪暫存檔。

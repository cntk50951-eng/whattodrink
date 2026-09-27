# 2026-09-27 C.17 在線朋友模式＋信息卡＋並行 tsc 紅定罪

## 情境

- 用戶三件：①在線朋友鈕（藏我只顯友）②跨區自動縮放裝下所有人 ③點圈先看信息卡（含最近上線，DB 可改），卡內鍵再進聊天頁。
- 同伴 C.16 同文件（V2Home）施工中；中途 tsc 紅。

## 問題

1. `tsc` 報 `V2Home(1143) TS1005`＋尾部 cascade——第一反應是我 pills edit 斷 JSX。
2. `lib/chat.test.ts` 1 紅：簡中期望手寫 "2 小时前"，ICU 實出 "2小时前"。
3. `V2FriendCard` 三錯：`avatarUrl` 寫錯，`LiveFriend` 是蛇形 `avatar_url`。

## 原因

1. `git diff` 分贓＋逐 hunk 讀：我的 hunks（import／state／3 函數／props／1 Button／1 自閉合組件）結構全平衡——**tsc 紅是同伴 C.16 中間態**（mode-pill 刪除＋dropdown 重寫交織中），我排查途中它自修復（重跑即淨；transpile 雙版零錯佐證）。
2. ICU 簡中相對時間無空格是正確行為，我憑繁中印象寫期望。
3. 跨文件字段口徑沒對（V2Home 用 `avatar_url`，我憑 ChatPeer 駝峰寫錯）——恰好也是擋同伴 build 的三錯，修完雙線解堵。

## 修正

- `formatSeenAgo`（`Intl.RelativeTimeFormat`，三語零新 key，未來鉗零）＋3 單測（7 綠）；`updated_at` 端到端現成，**DB 免改動**（用戶允改但無需改）。
- pills 第 6 顆（secondary 选中態）＋`fitPoints` 複用（單點／reduced-motion 內建；`minZoom:10` 跨洋鉗制是地圖配置另案）；無人 toast 不進空圖。
- `V2FriendCard`（C.10 同容器）＋pin→卡→頁；離線自動收卡。
- 教訓：並行紅先分贓（`git diff -U0` 看 hunk 清單）再定罪，別先懷疑自己；期望文案以 ICU 實出為準，不要憑印象。
- temp：`/tmp/v2home.diff` 本輪排查產物，用完即刪（照 tmp-cleanup 規則）。

## 關聯

- UR C.17 [WIP]；DEF-20260927-007（行為改 pin→卡，根因待用戶回填三問＋直接 URL 複驗）

# Architecture — 技術棧決策

## Stack

| 層 | 選什麼 | 原因 |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | SSR/SSG 支援酒吧頁 SEO（產品目標：流量入口） |
| **Runtime** | React 19 + RSC | Server component 預設，bundle 小、SEO 好 |
| **Styling** | Tailwind CSS v4 + CSS variables | Token-based，主題切換 = 換 CSS var |
| **UI components** | shadcn/ui (base-ui 後端) | Copy-paste，可客製化；不用 Radix 因為新版改 base-ui |
| **Backend (planned)** | Supabase 託管路線 A | Postgres + Auth + Storage + Realtime 一站；MVP 免費額度夠 |
| **AI (planned)** | Claude API | 情緒分析、食物配酒、視覺選酒 |
| **Bars (planned)** | Google Places API | 找香港本地酒吧 |
| **Image gen (utility)** | MiniMax image-01 | UI 風格探索階段產圖用 |
| **Hosting (planned)** | Vercel | 與 Next.js 同源，edge 節點近 HK |
| **Node** | 22+ | `nvm use 22`，Next.js 16 要求 |

## 不做

- ❌ **Micro frontends** — 過度設計。Feature 用 route groups 隔離，需要再拆就走 Multi-Zones
- ❌ **Redux / Zustand / Jotai 等全域 state lib** — React state + URL state + Server Component + Supabase realtime 已經夠
- ❌ **提前做 schema 設計** — UI-first 原則（schema-on-read），UI 寫完才回頭看需要什麼欄位
- ❌ **MFA / Module Federation** — 見上
- ❌ **i18n library（next-intl 等）** — 先把 zh-Hant / en 都 inline，等真的要國際化再說
- ❌ **Storybook** — 等真的有 reusable design system 再裝

## 主題系統設計

```
每個 theme = {
  id, name, description, tokens: { "--xxx": "oklch(...)" }
}

ThemeProvider (client component)
  → 讀 localStorage 恢復選擇
  → 把 tokens 套到 <html> 的 inline style
  → 任何未覆蓋的 CSS var 走 globals.css :root 預設值

新增 theme：
  1. lib/themes/presets/<slug>.ts 寫一個 Theme 物件
  2. lib/themes/registry.ts 的 themes 陣列加進去
  3. ThemePicker 自動出現
```

## 建表門禁（schema-from-UI，UR A.3 硬規則）

UI-first 的執行點：每次寫 migration **之前**，先從前端需求倒推 schema，
不許從 ER 圖正推。步驟固定：

1. **列 UI 面**：本次建表服務哪些 route／component（具名，如 `/wall`＋`MapHotBoard`）。
2. **逐字段過堂**：每個 column 回答「前端哪裡讀／寫它」（指到 lib type 或 `docs/data/*` 行）。答不出的字段不建（YAGNI）；答得出但表裡沒有的，補上才准寫 SQL。
3. **合規複核**：visibility 預設／RLS 檔位／精確座標去向／保留期（沿 `api-architecture.md` §7，不複述第二遍）。
4. **空窗安全**：新表 RLS 全 ENABLE、policy 另批——建完到 policy 落地之間全拒。
5. **seed 誠實**：只放真實靜態數據（如 beers）；假用戶／假互動不進庫，牆等真分享長出來。

## 待補 ADR

之後在 `docs/adr/` 建立 Architecture Decision Records，目前用這個檔案暫代。

## 已知限制

- Node 22 是 hard requirement（scaffold 跑過 v18 失敗）
- macOS only 開發環境驗證過；其他平台未測
- Supabase 路線 B（自架）暫不考慮

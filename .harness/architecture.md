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

## 待補 ADR

之後在 `docs/adr/` 建立 Architecture Decision Records，目前用這個檔案暫代。

## 已知限制

- Node 22 是 hard requirement（scaffold 跑過 v18 失敗）
- macOS only 開發環境驗證過；其他平台未測
- Supabase 路線 B（自架）暫不考慮

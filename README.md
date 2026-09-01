# Whattodrink

A Hong Kong drinking-mood companion app. 25–35 歲香港人的「今晚喝咩？」隨機抽酒 + 心情記錄 + 拍照選酒 + 多人酒桌遊戲 + 本地酒吧推薦。

## 文檔索引

- [`docs/PRODUCT_BACKLOG.md`](docs/PRODUCT_BACKLOG.md) — 產品願景、用戶場景、Epic 拆解
- [`CHANGELOG.md`](CHANGELOG.md) — 開發日誌，每次重要修改會在這裡記一筆

## 技術棧

- **框架**: Next.js 16 (App Router) + React 19
- **樣式**: Tailwind CSS v4 + CSS variables（支援多主題切換）
- **UI 元件**: shadcn/ui（待初始化）
- **後端**: Supabase（待接入）
- **AI**: Claude API（待接入）
- **託管**: Vercel（待部署）
- **Node**: 22+（用 `nvm use 22`）

## 開發指令

```bash
nvm use 22
npm install
npm run dev          # 起 dev server (http://localhost:3000)
npm run build        # 生產 build
npm run lint         # ESLint
```

## 設計原則

1. **UI-first prototyping** — 先寫 UI 才設計資料庫，schema-on-read
2. **Theme is swappable** — 多種視覺風格讓用戶自己切，不鎖死單一調性
3. **No micro-frontend** — 單一 Next.js app，feature 用 route groups 隔離
4. **Ship lean** — MVP 階段不過度設計

## 風格探索

`UI style/` 目錄下有 20 種風格的啤酒主題圖（MiniMax image-01 生成），作為 design system 選型參考。

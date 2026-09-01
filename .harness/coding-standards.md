# Coding Standards — 程式碼風格

## TypeScript

- `strict: true`（tsconfig 已開）
- 不用 `any`，用 `unknown` 然後 narrow
- 公開函式一定有顯式 return type
- type-only import 用 `import type`
- enum 少用，改用 `as const` object + union type

## React

- **Server component by default**（不加 `"use client"`）
- 只有需要 state / effect / event / browser API 時才標 `"use client"`
- 避免 prop drilling：>2 層用 Context 或拆 component
- 不要在 render 裡建立新物件/陣列傳給 memo'd component
- 不要用 inline `style` 物件（CSS variable 透過 `style` 設定例外）

## 檔案結構

```
app/                    Next.js App Router pages
  (marketing)/          公開頁（landing、SEO 內容）
  (app)/                登入後主功能
  (game)/               酒桌遊戲
  themes/               [WIP] theme presets 暫放這
components/
  ui/                   shadcn 元件（不要手改，跑 shadcn add 更新）
  *.tsx                 自己寫的 component
lib/
  themes/               Theme registry 與 presets
  utils.ts              shadcn cn() helper
  supabase/             [WIP] Supabase client
docs/
  PRODUCT_BACKLOG.md
  adr/                  [WIP] Architecture Decision Records
.harness/               本目錄
.memory/                教訓紀錄
```

## 命名

| 類別 | 命名 | 範例 |
|---|---|---|
| Component | PascalCase | `ThemePicker.tsx` |
| Hook | `useCamelCase` | `useTheme.ts` |
| Util / helper | camelCase | `cn.ts`、`parseDate.ts` |
| 常數 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| CSS variable | `--kebab-case` | `--color-primary` |
| Theme id | kebab-case | `"neo-brutalism"` |
| Route | kebab-case | `/bars/[slug]` |
| DB column | snake_case | `created_at` |
| DB table | snake_case 複數 | `mood_logs` |

## Import 順序

1. Node built-in
2. external packages
3. `@/` 別名
4. 相對路徑

組與組之間空一行。

## 不做

- ❌ Magic numbers — 抽常數
- ❌ `console.log` 留在 production code
- ❌ 用 `// @ts-ignore` — 改用 `// @ts-expect-error` + comment 說明
- ❌ 任何型別用 `any`
- ❌ 把 secrets 寫進 source code（用 `.env`，參考 `.env.example`）

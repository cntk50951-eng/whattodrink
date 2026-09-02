# 2026-09-02: Stack layout primitive 必須支援 responsive variants

## 情境

寫首頁 sections（how-it-works、features、community-preview、cta-banner）時，第一個版本 `Stack` 只接受固定 string：

```ts
direction?: "col" | "row"
align?: "start" | "center" | "end" | "stretch"
gap?: "1" | "2" | "3" | "4" | "6" | "8" | "12"
```

結果 footer 想用 `direction={{ base: "col", md: "row" }}`（手機直排、桌機橫排），TS 報錯：

```
Type '{ base: string; md: string; }' is not assignable to type '"col" | "row" | undefined'.
```

另外 sections 想用 `gap="10"`，但 Gap union 沒包含 `"10"`：

```
Type '"10"' is not assignable to type '"1" | "2" | ... | "12" | undefined'.
```

## 問題

初始設計 `Stack` 為單一 breakpoint string，沒預留響應式介面。每個 section 都需要 responsive 行為，導致 4 個 call site 都壞掉。

## 原因

- 第一次寫 layout primitive 時圖省事，沒考慮 UR 1.0（自適應）對 primitive 的實際需求
- 把「設計 primitive」和「定義 token 範圍」混為一談，token 範圍給少了
- 沒預先在 `.harness/coding-standards.md` 規定 layout primitive 必須支援 responsive

## 修正

`components/layout/stack.tsx` 重構為：

```ts
type Responsive<T extends string> = T | Partial<Record<"base" | "md" | "lg", T>>;

direction?: Responsive<Direction>
gap?: Responsive<Gap>           // 含 "10"
align?: Responsive<Align>
justify?: Responsive<Justify>
```

內部用 helper `variantClass(prefix, value, options)` 把 string 或物件攤成 Tailwind class 陣列（含 `md:` `lg:` 前綴）。

## 學習

- **Layout primitive 預設就要支援 responsive** — UR 1.0 是這個專案的硬需求，不要寫出單 breakpoint 的版本
- **Token 範圍寧可多給**：gap scale 直接給到常用的 `0/1/2/3/4/6/8/10/12`，不要吝嗇
- **新 primitive（Grid / Container / Section）設計時先想**：call site 會傳什麼？目前哪些 call site 用到 responsive？

## 相關

- `components/layout/stack.tsx` — 重寫後版本
- `.harness/coding-standards.md` — 之後可加「layout primitive 必須支援 responsive variants」條目
- `.harness/architecture.md` — 可加 layout primitive 設計指引

## 待補

- [ ] 把「layout primitive 必須支援 responsive variants」寫進 `.harness/coding-standards.md`
- [ ] `Grid` 目前也只接受 fixed cols，之後改成 Responsive 物件（雖然目前 call site 沒用到）

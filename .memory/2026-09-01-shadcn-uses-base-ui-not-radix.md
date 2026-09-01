# 2026-09-01: shadcn 新版用 @base-ui/react，不是 Radix UI

## 情境

裝完 shadcn/ui 後寫 `<DropdownMenuTrigger asChild><Button>...</Button></DropdownMenuTrigger>`，build 失敗：
```
components/theme-picker.tsx(20,28): error TS2322: Type '{ children: Element; asChild: true; }' is not
assignable to type 'IntrinsicAttributes & Props<unknown>'.
  Property 'asChild' does not exist on type 'IntrinsicAttributes & Props<unknown>'.
```

## 問題

shadcn/ui 在 2024–2025 之間從 Radix UI 切換到 **Base UI**（`@base-ui/react`，MUI 出的 headless lib）。
Base UI 的 composition API 不用 `asChild`，改用 `render` prop：

```tsx
// ❌ 舊（Radix 風格）
<DropdownMenuTrigger asChild>
  <Button>...</Button>
</DropdownMenuTrigger>

// ✅ 新（Base UI 風格）
<DropdownMenuTrigger render={<Button>...</Button>} />
```

## 原因

- shadcn 預設 preset 從 `radix-nova` 之類改成 `base-nova`
- 安裝時指定 `--base base` 就會走 Base UI
- 訓練資料裡 shadcn 範例幾乎都還是 Radix 寫法，會誤導

## 修正

把 Trigger 改成 `render` prop，並從 `@base-ui/react/<primitive>` 確認每個 primitive 的型別來源。

未來寫 shadcn 元件時先看 `components/ui/*.tsx` 裡的 primitive 來源（檔頭的 `import`），不要憑印象寫。

## 學習

- 寫 shadcn 元件組合前先看 `components/ui/` 下的程式碼風格
- 看到 `asChild` 報錯 → 換 `render` prop
- primitive 是 Radix 還是 Base UI，看 import path：`@radix-ui/*` vs `@base-ui/react/*`

## 相關

- `.harness/architecture.md` — UI 元件說明

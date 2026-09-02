# 2026-09-02: base-ui DropdownMenu 的兩個坑（label 要包 group、trigger 不要用 render）

## 情境

把 shadcn 預設的 Radix-based DropdownMenu（shadcn 換到 base-ui）改成 ThemePicker 跟 LanguagePicker。兩種瀏覽器測試都失敗：
1. 點 trigger 按鈕顯示「no page found」而非展開 dropdown
2. 即使展開也沒內容

## 問題 1：base-ui Menu.Trigger 的 render prop 不傳 children

shadcn 在 Radix 時代用 `asChild` prop：
```tsx
<DropdownMenuTrigger asChild>
  <Button>...</Button>
</DropdownMenuTrigger>
```

切到 base-ui 後官方 pattern 是 `render`：
```tsx
<DropdownMenuTrigger render={<Button>...</Button>} />
```

但 `render={<Button>...</Button>}` pattern **不會把 Button 的 children（icon + text）傳進 trigger 元素**。結果 trigger 是空按鈕，沒有視覺內容，也沒有正確的 event handler 合併。

用 curl 檢查 HTML 確認：trigger button 完全沒有 icon 跟文字 children。

## 問題 2：base-ui DropdownMenuLabel 需要包在 DropdownMenuGroup 內

shadcn 的 `<DropdownMenuLabel>` 在 Radix 是直接放在 Content 裡。base-ui 的 MenuGroupContext 要求 label / separator / items 必須包在 `<DropdownMenuGroup>` 內。

不包會 throw error：
> "Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>."

錯誤導致整個 DropdownMenu 不渲染 → click trigger 看似跳頁（其實是 throw 了 React error）。

## 修正

**Trigger pattern：直接套 button styles，不用 render / Button wrapper**
```tsx
import { buttonVariants } from "@/components/ui/button";

<DropdownMenuTrigger
  className={cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "gap-2",
  )}
>
  <Palette className="size-4" />
  <span>{t("options." + themeId)}</span>
</DropdownMenuTrigger>
```

**Label pattern：包 DropdownMenuGroup**
```tsx
<DropdownMenuContent>
  <DropdownMenuGroup>
    <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
    <DropdownMenuSeparator />
    {items.map(...)}
  </DropdownMenuGroup>
</DropdownMenuContent>
```

## 學習

- **base-ui 跟 Radix 的 API 表面相似但語意不同**：很多 shadcn 教學是 Radix-based，切到 base-ui 後要重新理解每個 primitive 的 contract
- **`render` prop 不會傳 children**：跟 React.cloneElement 不一樣；base-ui 自己 document 沒強調，容易踩
- **看到「點下去跳頁」先看 console**：當 click 行為反直覺時，pageerror 通常會講實話
- **shadcn 換 base-ui 後的元件契約**：Menu.Group / Menu.RadioGroup 是強制的，Label / Separator / Items 必須在裡面

## 相關

- `components/theme-picker.tsx` — 重寫後版本
- `components/language-picker.tsx` — 重寫後版本
- `components/ui/dropdown-menu.tsx` — shadcn base-ui 的 dropdown 封裝

## 快速 checklist（之後寫 base-ui dropdown 時）

- [ ] Trigger 用 className，不要用 `render={<Button>}` 或 `asChild`
- [ ] Label / Separator / Items 必須包在 `DropdownMenuGroup` 內
- [ ] DropdownMenuTrigger 的 children 要直接放在 JSX 裡（icon + text）
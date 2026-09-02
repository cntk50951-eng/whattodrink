# 2026-09-02: base-ui Popover + Sheet 雙軌切換器架構

## 情境

UR 1.2 要求：桌面用 Popover（anchored）做主題切換，手機用 bottom Sheet。同一個 trigger 按鈕要兩種行為依 viewport 切換。

## 問題

base-ui PopoverTrigger 和 SheetTrigger 是兩個不同 primitive，互不相通。要讓同一個 trigger 對應到兩個不同 container，需要兩個完整的開關組合（trigger + content），各自管理自己的開關狀態。

## 修正

寫成兩個並行的 switcher 區塊，用 Tailwind responsive class 互斥顯示：

```tsx
{/* Desktop: hidden md:inline-flex on trigger, hidden md:block on content */}
<Popover>
  <PopoverTrigger className="hidden md:inline-flex">...</PopoverTrigger>
  <PopoverContent className="hidden md:block">...</PopoverContent>
</Popover>

{/* Mobile: md:hidden on trigger */}
<Sheet>
  <SheetTrigger className="md:hidden">...</SheetTrigger>
  <SheetContent side="bottom" className="md:hidden">...</SheetContent>
</Sheet>
```

兩個 trigger 視覺上一致（用同樣的 `className` 含 `inline-flex items-center gap-2 ...`），內容也共用 `<ThemePreviewCard>` 元件。CSS 確保桌面只看到 Popover、手機只看到 Sheet。

## 主題預覽卡：local CSS vars injection

每個主題有自己的 `--color-*` tokens。預覽卡要在「當前主題」的背景下顯示該主題的真實外觀，所以預覽卡的容器要**局部套用該主題的 tokens**：

```tsx
<div style={theme.tokens as React.CSSProperties}>
  {/* 內部用 semantic tokens（bg-card、text-foreground 等），會解析成該主題的值 */}
  <div className="bg-card" />
</div>
```

這樣預覽卡永遠顯示「如果切到這個主題，這裡會長怎樣」。

## 語言 segmented control

不用下拉，按鈕組即時可見：
```tsx
<div role="group" aria-label={t("label")}>
  {locales.map(locale => (
    <button aria-pressed={current === locale} onClick={() => select(locale)}>
      {SHORT_LABEL[locale]}
    </button>
  ))}
</div>
```

UR 1.2 AC2「超過 4 語言降級為更多入口」目前 3 語用不到，但架構已預留：包一個 `+ more` popover 把第 5+ 個塞進去。

## 學習

- **base-ui Popover / Dialog / Menu trigger 不互通**：每個 primitive 有自己的 trigger 與 content pair。要做「同 trigger 不同行為」必須 render 兩套
- **local CSS vars injection 是 theme preview 的標準做法**：`<div style={theme.tokens}>` 一行解決所有主題預覽
- **Tailwind responsive + 多套 trigger**：乾淨但語意需明確，每套都要寫完整的 trigger + content

## 相關

- `components/theme-switcher.tsx` — 雙軌主題切換
- `components/language-switcher.tsx` — segmented control
- `components/theme-preview-card.tsx` — 局部套用主題 tokens 的預覽卡
- `components/ui/popover.tsx` — shadcn 新加（PopoverPrimitive）
- `components/ui/sheet.tsx` — shadcn 新加（DialogPrimitive）
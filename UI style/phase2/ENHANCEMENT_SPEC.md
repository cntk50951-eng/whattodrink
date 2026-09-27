# UR1.4 POC 增強規格文檔

> 目標：將 15 個 POC 從「原型級」提升至「專業展示級」，達到可直接用於 PM 評審、設計交接、甚至生產參考的水準。

---

## 1. 線條標準

### 1.1 描邊權重體系
| 用途 | 粗細 | 用途說明 |
|------|------|----------|
| Hairline | 0.5px | 內部細節線、紋理線、高光線 |
| Thin | 1px | 內部結構線、紋理主線 |
| Standard | 1.5px | **主輪廓線**（標準描邊） |
| Medium | 2px | 重點輪廓、重要邊界 |
| Bold | 2.5-3px | 主體外輪廓、強調邊框 |
| Extra Bold | 4px+ | 英雄元素外框、分隔帶 |

### 1.2 線條品質要求
- **曲線平滑度**：所有貝塞爾曲線控制點優化，無明顯折點
- **端點處理**：`stroke-linecap: round` / `square` 視語境決定
- **轉角處理**：`stroke-linejoin: round`（有機形狀） / `miter`（幾何形狀）
- **虛線規範**：`stroke-dasharray: 4 3`（細虛線） / `8 4`（粗虛線）

### 1.3 專業線條技巧
- **線條疊加**：深色底線 + 淺色高光線 = 立體邊緣
- **線條漸變**：`stroke: url(#gradient)` 實現線條明暗變化
- **線條抖動**：`<filter><feTurbulence><feDisplacementMap>` 模擬手繪感

---

## 2. 紋理與顆粒標準

### 2.1 紋理層級體系
| 層級 | 不透明度 | 混合模式 | 用途 |
|------|----------|----------|------|
| Micro | 3-5% | multiply | 全局紙張紋理 |
| Fine | 8-12% | multiply/overlay | 材質紋理（紙、木、金屬） |
| Medium | 15-20% | multiply | 明顯材質感（帆布、皮革） |
| Coarse | 25-35% | overlay/soft-light | 強烈質感（石頭、磚牆） |

### 2.2 SVG 紋理實現標準
```xml
<!-- 標準紙張紋理 -->
<filter id="paperGrain">
  <feTurbulence type="fractalNoise" baseFrequency="0.7-0.9" numOctaves="2-3" stitchTiles="stitch"/>
  <feColorMatrix values="0 0 0 0 0.03  0 0 0 0 0.05  0 0 0 0 0.07  0 0 0 0.15 0"/>
  <feComposite operator="in" in2="SourceGraphic"/>
</filter>

<!-- 材質專用紋理 -->
<filter id="woodGrain">
  <feTurbulence type="fractalNoise" baseFrequency="0.05 0.8" numOctaves="3" stitchTiles="stitch"/>
  <feColorMatrix type="hueRotate" values="30"/>
</filter>

<!-- 手繪抖動 -->
<filter id="wobble">
  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2"/>
  <feDisplacementMap in="SourceGraphic" scale="1.5-3"/>
</filter>
```

### 2.3 紋理應用規範
- **全局紋理**：`body::before` 固定定位，`mix-blend-mode: multiply`
- **元素紋理**：每個著色形狀獨立 `filter="url(#grain)"`
- **邊緣磨損**：`feTurbulence` + `feMorphology` 邊緣擴展 + mask

---

## 3. 顏色精度標準

### 3.1 調色盤管理
- **主色**：精確到十六進制，提供 `--color-*` CSS 變量
- **語意色**：`--color-primary` / `--color-surface` / `--color-text`
- **狀態色**：`hover` / `active` / `focus` / `disabled` 完整定義

### 3.2 漸層專業標準
```css
/* 線性漸層：最少 3 個 stop，模擬光影 */
linear-gradient(180deg, #fff 0%, #e8e8e8 50%, #d0d0d0 100%)

/* 徑向漸層：模擬光源 */
radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.8), transparent 60%)

/* 多層疊加：背景 + 紋理 + 光暈 */
background: 
  linear-gradient(...), 
  radial-gradient(...),
  url("data:image/svg+xml,...");
```

### 3.3 色彩模式
- **平面配色**：無漸層，純色塊 + 描邊（Ligne Claire 風格）
- **漸層配色**：3+ stop 線性/徑向漸層（Y2K、Neon、Gouache）
- **印刷模擬**：Riso 套印偏移、Litho 專色疊加、Screen Print 網點

---

## 4. 細節密度標準

### 4.1 插畫細節等級
| 等級 | 元素數量 | 細節類型 | 適用風格 |
|------|----------|----------|----------|
| Minimal | 10-20 | 基礎幾何 | Ligne Claire, Minimal |
| Standard | 30-50 | 結構+紋理 | Mid-Century, Urban |
| Rich | 60-100 | 結構+紋理+裝飾 | Gouache, Collage, Pop |
| Ultra | 100+ | 全維度細節 | Pop Narrative, Y2K, Neon |

### 4.2 必備細節清單（按風格）
| 風格 | 必備細節 |
|------|----------|
| Ligne Claire | 統一線寬、無漸層、幾何簡化、紅藍強調 |
| Mid-Century | 建築窗格、船帆細節、木紋、太陽光暈、雲層疊加 |
| Cutout | 紙張疊層陰影、撕邊不規則、膠帶、紙張紋理 |
| Doodle | 手繪抖動、塗鴉元素、對話框、箭頭、星星 |
| Pop | Ben-Day 點、動作線、爆炸框、粗黑框 |
| Neon | 光暈、電弧、網格地板、霓虹管反射 |
| Gouache | 筆觸方向、顏料堆疊、邊緣乾燥、紙紋 |
| Riso | 套印偏移(1-3px)、油墨顆粒、第三色疊加 |
| Watercolor | 濕邊暈開、顏料分離、水痕、留白 |

---

## 5. 專業光影與深度

### 5.1 陰影體系
```css
/* 硬邊偏移陰影 (Mid-Century, Ligne Claire) */
box-shadow: 4px 4px 0 0 var(--color-ink);

/* 軟陰影分層 */
--shadow-1: 0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04);
--shadow-2: 0 4px 8px rgba(0,0,0,0.06), 0 12px 24px rgba(0,0,0,0.06);
--shadow-3: 0 8px 16px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.08);

/* 發光效果 */
--glow-pink: 0 0 12px #ff1a8c, 0 0 32px rgba(255,26,140,0.5);
--glow-cyan: 0 0 12px #00f0ff, 0 0 32px rgba(0,240,255,0.5);

/* 內發光 */
box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.1);
```

### 5.2 SVG 光影技巧
```xml
<!-- 外發光 -->
<filter id="glow">
  <feGaussianBlur stdDeviation="4-8" result="blur"/>
  <feMerge>
    <feMergeNode in="blur"/>
    <feMergeNode in="blur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>

<!-- 內高光 -->
<filter id="innerHighlight">
  <feOffset dx="0" dy="-1"/>
  <feGaussianBlur stdDeviation="1"/>
  <feComposite operator="in" in2="SourceGraphic"/>
</filter>

<!-- 色彩溢出/套印偏移 -->
<filter id="misreg">
  <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="1"/>
  <feDisplacementMap in="SourceGraphic" scale="1.5"/>
</filter>
```

---

## 6. 排版專業標準

### 6.1 字體層級
| 層級 | 字體 | 權重 | 字距 | 行高 |
|------|------|------|------|------|
| Display | Playfair/Archivo/Orbitron | 800-900 | -0.03~0.04em | 0.9-1.0 |
| Headline | Playfair/Archivo/Inter | 700-800 | -0.02em | 1.05-1.15 |
| Body | Inter/Noto Sans | 400-500 | 0 | 1.6-1.7 |
| Label | Inter/Archivo | 700-800 | +0.08-0.18em | 1.2-1.4 |

### 6.2 對齊與節奏
- **基線網格**：8px 基線，所有元素高度為 8 的倍數
- **模塊化比例**：1.25 (Major Third) 或 1.618 (Golden Ratio)
- **留白系統**：`--space-*` 8px 基礎，`1.5x` `2x` `3x` 級數

---

## 7. 動畫與互動專業度

### 7.1 過渡標準
```css
/* 標準過渡 */
transition: transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94),
            box-shadow 0.15s ease,
            background 0.15s ease;

/* 按鈕 hover */
transform: translate(-2px, -2px);
box-shadow: 4px 4px 0 0 var(--color-ink);

/* 卡片 hover */
transform: translate(-3px, -3px);
box-shadow: 0 12px 24px rgba(0,0,0,0.12), 0 24px 48px rgba(0,0,0,0.08);
```

### 7.2 SVG 動畫
```xml
<!-- 脈動 -->
<animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/>

<!-- 旋轉 -->
<animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="20s" repeatCount="indefinite"/>

<!-- 路徑繪製 -->
<animate attributeName="stroke-dashoffset" from="1000" to="0" dur="2s"/>
```

---

## 8. 無障礙與性能

### 8.1 無障礙檢查清單
- [ ] 色彩對比度 ≥ 4.5:1 (AA) / 7:1 (AAA)
- [ ] `prefers-reduced-motion` 禁用非必要動畫
- [ ] 語義化 HTML，ARIA 標籤完整
- [ ] 鍵盤可操作，焦點可見

### 8.2 性能指標
- [ ] SVG 內聯，無外部請求
- [ ] CSS 變量複用，無重複代碼
- [ ] 字體 `font-display: swap`，預載關鍵字體
- [ ] 無布局偏移 (CLS < 0.1)

---

## 9. 驗收檢查清單（每個 POC 必通過）

| 檢查項 | 標準 | 驗收方式 |
|--------|------|----------|
| 線條一致性 | 同類元素 stroke-width 差異 < 0.2px | 目測 + DevTools 檢查 |
| 紋理完整 | 所有著色形狀有紋理 filter | 關閉紋理對比 |
| 顏色準確 | 主色十六進制與設計稿一致 | 吸管工具驗證 |
| 細節密度 | 符合風格等級要求 | 計數 SVG 元素 |
| 陰影層次 | 3 層陰影正確疊加 | 關閉陰影對比 |
| 字體層級 | 4 層字體層級清晰 | 視覺檢查 |
| 響應式 | 320/768/1024/1440 無錯亂 | DevTools 設備模擬 |
| 無障礙 | Lighthouse ≥ 95 | 自動化測試 |
| 性能 | LCP < 2.5s, CLS < 0.1 | Lighthouse |

---

## 10. 執行順序與優先級

### Phase 1：核心風格（高優先級，已有 v3 基礎）
1. **01 Ligne Claire Noir** - 基準風格，必須完美
2. **05 Mid-Century Harbour** - 最複雜，已有 v3，需精修
3. **02 Urban Sip** - 現代風格，展示現代感
4. **03 Ligne Claire Urban** - 姊妹風格，對比參考

### Phase 2：特色風格（中優先級）
5. **04 Liquid Cyber Y2K** - 技術展示
6. **10 Liquid Neon** - 技術展示
7. **09 Modern Pop Narrative** - 風格鮮明

### Phase 3：手工/藝術風格（中優先級）
8. **12 Gouache Brew** - 材質感強
9. **15 Artisanal Gouache** - 精修版
10. **12/15 差異化** - 確保兩者可區分

### Phase 4：特殊工藝風格（標準優先級）
11. **06 Cutout Paper** - 紙藝
12. **13 Artisanal Lithograph** - 印刷工藝
13. **14 Aureate Mist** - 水彩

### Phase 5：手繪/敘事風格（標準優先級）
14. **07/11 Doodle 系列** - 手繪感
15. **08 Graphic Narrative** - 敘事
16. **09 Pop Narrative** - 風格化

---

## 10. 交付產出

每個 POC 交付：
1. **HTML 文件** - 完整獨立可運行
2. **設計系統 JSON** - 可導入 Stitch/Figma
3. **規格對照表** - 與 Stitch 設計的逐項對照
4. **技術說明** - 關鍵技術點、可復用組件、已知限制

---

*文檔版本：v1.0 | 更新：2026-09-03 | 適用：UR1.4 Phase 2 全 15 POC*
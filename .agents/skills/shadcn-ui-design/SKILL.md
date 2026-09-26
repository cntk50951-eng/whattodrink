---
name: shadcn-ui-design
description: whattodrink 项目 v2（EPIC C）UI 设计与 shadcn 组件使用规范。当任务涉及 v2 新增/修改界面、安装 shadcn 组件、选配色、调整主题时必须遵循。涵盖 registry-first 安装、dark-first 语义配色、V1/V2 隔离、三语门、验收清单。不适用于 v1 涂鸦 UI（v1 冻结，另见 harness）。
---

# shadcn UI 设计规范（whattodrink · v2 专用）

> 本 skill 是 **v2（EPIC C）UI 的唯一事实来源**，v1 涂鸦 UI 不归它管。
> UI 任务仍走 harness 10 步（gates／用户亲验／memory／不自动 commit），本 skill 只管「怎么做 UI」。
> 前置必读：`.harness/workflow.md` Step 4（V1／V2 隔离）＋ backlog EPIC C 铁律。

## 0. 作用域（硬性，违反即回滚）

1. **只做 v2**：路由頁面住 `app/[locale]/v2/...`，样式自带 module css 或 `[data-ui="v2"]` 作用域。禁改 v1 任何路由／页面／组件／样式／文案 key。
2. **v1 文件冻结**：`app/globals.css` 的 `:root`／`.dark` 块、`font-hand`、doodle tokens 一律只读。v2 token 另起作用域（如 `.v2-dark` class），换肤只改 v2 变量块。
3. **共用层只做加法**：`lib/`／`hooks/`／API／`messages`（v1 key 只读，新增 key 不改旧 key 一字；`lib` 新函数禁改旧签名语义）。
4. **提交自查**：v2 单 `git status` 无 v1 文件；改了共用层必须 v1／v2 双回归。

## 1. 核心原则

1. **Registry-first**：永远通过 `npx shadcn@latest add`（或 shadcn MCP，有的话）安装组件，绝不凭记忆手写 shadcn 风格组件。本项目 `components.json`（`style: base-nova`，rsc，已确认存在）＋ **`@base-ui/react` 后端——不是 Radix**，禁混 Radix 写法；新 lib／新版本先走 harness Step 3（context7）查最新 API。
2. **Dark-first（v2）**：夜间喝酒场景，深色默认，浅色附赠。
3. **语义化颜色**：只用语义 token（`bg-primary`、`text-muted-foreground`），禁止硬编码色值。
4. **组合而非改装**：用基础组件拼业务组件，不要直接改 `components/ui/` 源码。
5. **三语门**：任何用户可见文案必须进 `messages/*.json` 三语（zh-Hant／zh-Hans／en），缺 key 会炸整棵树；提交前跑 parity 检查（三档 key 数一致）。

## 2. 组件安装规范

### 2.1 安装前
- `components.json` 已存在，不跑 `init`。动手前先搜 registry（有 MCP 用 MCP，无 MCP 用 `npx shadcn@latest add`＋官方文档现查）：很可能已有现成的，搜不到才自己写，**不许臆造组件 API**。
- shell 注意：本机非交互 bash 跑 npm／npx 必须先 `export PATH="/Users/yuki/.nvm/versions/node/v22.22.0/bin:$PATH"`（harness 环境要求），裸 `npx` 会炸。

### 2.2 安装
```bash
npx shadcn@latest add button dialog card input # 按需安装，用到哪个装哪个
npx shadcn@latest add @magicui/shimmer-button # 第三方 registry 用命名空间
```
- 不要"以防万一"全量安装：每个组件都是复制进仓库、由你维护的代码。
- 第三方 registry 必须先配进 `components.json` 的 `registries` 字段（现为空对象，按需加）。

### 2.3 定制规则
- `components/ui/` 是 vendored 代码：**不直接改**。定制在项目目录包 wrapper（如 `components/v2/`），沿站内既有配方（`nativeButton={false}`＋`render` 等，见 mood 页）。
- 升级：`npx shadcn@latest add <name> --overwrite`，之前先 `git diff` 备份，定制重应用到 wrapper。
- 21st.dev `get`／`generate` 的 bespoke 代码同样不进 `components/ui/`，按第三方代码 review。

## 3. 配色系统（Dark-first，v2 作用域）

### 3.1 主题定义位置
- 本项目是 **Tailwind v4**（`@theme`／`@custom-variant`，见 `app/globals.css`），不用 v3 心智。v2 颜色只定义在 v2 作用域变量块（`.v2-dark` 等），**禁碰 `:root`／`.dark` 原块**。换肤＝只改 v2 变量块，不碰组件文件。

示例（v2 深色，oklch）：
```css
.v2-dark {
  --background: oklch(0.16 0.01 260); /* 近黑，带一点冷调 */
  --foreground: oklch(0.93 0.01 260); /* 主文字 */
  --card: oklch(0.20 0.015 260); /* 卡片底 */
  --primary: oklch(0.75 0.15 75); /* 品牌琥珀金：CTA、选中态、高光 */
  --muted: oklch(0.25 0.02 260); /* 次级底 */
  --muted-foreground: oklch(0.65 0.02 260); /* 次级文字 */
  --border: oklch(0.30 0.02 260); /* 边框 */
  --destructive: oklch(0.60 0.20 25); /* 危险操作 */
}
```

### 3.2 用色铁律
1. **一个主强调色**：全站只有一个品牌强调色（默认琥珀金，呼应威士忌/鸡尾酒）。只用在 CTA 按钮、选中态、关键高光。不要一个页面出现三种"强调色"。
2. **禁止硬编码**：组件里不准出现 `bg-amber-500`、`text-[#f59e0b]`，一律 token。第三方组件自带硬编码，装完第一件事换成 token。
3. **文字层级只用三档**：`foreground` → `muted-foreground` → 更弱用透明度。不自创第四档灰。
4. **对比度**：正文 ≥ 4.5:1，`muted-foreground` 深色底清晰可读（交用户肉眼终验）。
5. **渐变克制**：只用于 hero/氛围背景，不用于按钮和文字。
6. **destructive 唯一**：红色只给删除/危险操作，不做装饰色。

### 3.3 换主题流程
只改 §3.1 的 v2 变量块 → 全站（v2 内）自动生效 → 交用户截图验收（见 §6）。不允许逐个文件改颜色，更不允许动 v1 变量块。

## 4. 排版与间距

- 字体沿现有管线（Geist＋Caveat，见 `app/globals.css`）：**不另起字体管线**（sandbox 字体构建坑有 memory）。真要加字（如 Noto Sans TC）另开任务，先验证构建。
- 标题、正文、辅助三层级，字号差至少 2px 起跳，不要 13px vs 14px 假层级。
- 间距 4px 基准（Tailwind 默认 scale），卡片内边距优先 `p-4`／`p-6`，禁 `p-[13px]` 随意值。
- 触点 ≥44px；iPhone home bar 留 safe-area；键盘可达（button 可 Tab，操作有 `aria-label`）。

## 5. 动效与运行时安全

- 氛围动效：转场 200–300ms、`ease-out`，不弹跳；hover 提亮、选中 primary、切页淡入，全站统一。
- **`prefers-reduced-motion` 必降级**（本站硬規則）：动效走 `motion-safe:` 或 media query 包裹，reduced 下静止。
- **hydration 安全**：localStorage 读必须 `useSyncExternalStore`（server 快照恒定），禁 render 内直接读（本站三次 crash 教訓）。
- Server Component by default；要 state/effect 才 `"use client"`（harness coding-standards）。

## 6. 验收清单（每次 v2 UI 改动后逐项过，不过不交付）

- [ ] `git status` 无 v1 文件；`globals.css` 原块、`messages` 旧 key 零改动（diff 验证）
- [ ] 三语 key 三档一致（parity 脚本 PASS），无硬编码用户文案
- [ ] 深色下文字全可读；强调色唯一且只在 CTA/选中/高光
- [ ] 无硬编码色值（搜 `#[0-9a-f]`、`bg-(red|amber|blue|green)-` 无结果，装饰渐变除外）
- [ ] 基础组件来自 `components/ui/` 或其 wrapper，无手搓重复实现
- [ ] reduced-motion／safe-area／键盘操作合规
- [ ] `npm run build`＋`lint`＋`test` 全绿（harness gates，agent 照跑）
- [ ] **浏览器验收交用户**：agent 不开浏览器不截图，给用户 URL＋检查项，等「OK 可以 commit」（harness Step 10 分工）

# 2026-09-05 — Tailwind 任意类被扫描器静默吞掉（定位不生效的根因）

## 情境
- UR1.4 把啤酒按钮沉左下角：`bottom-[max(0.75rem,env(safe-area-inset-bottom))]`。
  用户在 localhost 说位置完全没变。

## 问题
- 不是没保存、不是分支错、不是缓存：dev server 正常重编译了，
  但编译产物里根本没有这条规则。

## 原因
- Tailwind 扫描器对某些任意类静默丢弃：
  `bottom-[max(0.75rem,env(safe-area-inset-bottom))]` 不生成，
  而兄弟写法（calc 版、pb 的 max(1rem, env(safe-area-inset-bottom)) 版）都生成。
  同病：`delay-[${n}ms]` 模板字符串动态类永远不生成（扇形错峰从没跑过）。
- 特征：无报错、无警告，样式“没穿上”，页面看起来像代码没生效，
  极易误判成缓存／分支问题。

## 修正
- 复杂定位回纯 CSS Module（`.fabDock`／`.fabLifted` 互斥切换，
  不和 Tailwind 层打架）；动态延迟改 CSS 变量
  （`style={{"--fan-delay": ...}}`＋`.fanItem`，规范允许 CSS 变量走 style）。
- 验证手法：`grep` `.next/dev/static/chunks/*.css` 确认规则真的进了产物，
  再叫用户刷新。这比“你清下缓存”可靠。
- 二阶教训（2026-09-05 当天）：这篇 memory 和 CHANGELOG 里我曾把类名缩写，
  方括号里用三个点代替 env 的参数，Tailwind 连 .md 都扫描，把三个点原样
  生成成非法 CSS，直接炸掉 build。铁律：文档里永远不要写“长得像任意类”
  的缩写，省略号尤其致命；真要引用类名就写全称。
- 三阶（同一天）：源头清掉后页面照样报错——坏规则躺在 `.next` 缓存里，
  dev server 不重新扫描。解法：`rm -rf .next` 后重启 dev server。
  全工作区审计确认无第二源头（仅剩 JS 展开 `[...prev]` 和中文文档误报）。

# 2026-09-04 移动端导出链路打通（web 生成时顺带产 iOS/Android 图）

- 结论：可行，已跑通，30 个 icon 全部产出（270 PNG＋30 SVG＋manifest）。
- 链路（`npm run export:icons`，无需 dev server／浏览器）：
  BEER_WALL（唯一源）→ make-wall.ts（tsx 写法，esbuild 打包后 node 跑）→
  纯 SVG（浅色 token 烘焙、本地 Caveat）＋ resvg 4x PNG → sips 下采样
  （iOS @1x/@2x/@3x；Android mdpi→xxxhdpi）→ exported/beer-icons/。
- 途中踩掉的三条死路（都记进 skill 第 5 节）：
  1. puppeteer＋系统 Chrome：沙盒里 node 起的 Chrome 直接被杀，CLI 截图 SIGABRT；
  2. tsx：CLI 要建 IPC socket，沙盒禁 unix-socket listen（连 /tmp 下都不行）；
  3. headless Chrome --dump-dom 可用但 --screenshot 必崩（compositor 起不来）。
- 质检：抽看 @3x（Asahi／Snow），Caveat 手写体＋CJK fallback＋抖动滤镜都对；
  黑底只是聊天图片预览的合成，文件实测 RGBA 透明，各密度尺寸精确。
- 附带重构：预览页改读 BEER_WALL（行为不变），以后加 icon 只改 wall.ts＋barrel。
- 工具依赖：@resvg/resvg-js 留在 devDeps；tsx／puppeteer-core 装过又删了，
  不要再装。npm 在此沙盒一律加 --cache /tmp/npm-cache。

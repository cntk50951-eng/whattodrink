# 2026-09-05 — 隐藏扇形仍占位，啤酒被顶上天（用户自己定位到根因）

## 情境
- 啤酒按钮几次沉底用户都说“完全没生效”。用户猜：按钮高度按展开后
  面板算的，所以显示偏上。

## 问题
- 用户 100% 正确。容器是 bottom 锚定的 column-reverse，关闭时 6 个扇形格
  只是 opacity-0（仍在流内，各占约 54px）；column-reverse 里啤酒是最后
  一个 DOM，被 6 个隐形格垫在约 360px 高处。bottom 值改得再低，
  啤酒都悬在半空——之前所有“沉底”改动全被这个抵消。
- 附带：顺序理解也是反的——column-reverse 里第一个 DOM 在最下，
  扇形实际是朝下展开的，之前的注释写反了。

## 原因
- opacity/transform/pointer-events 都不影响 layout 占位；只有脱离流
 （absolute / hidden / 高度归零）才行。review 时只看了可见态，没看
  关闭态的盒模型。

## 修正
- 扇形格改绝对定位，用 CSS 变量 `--fan-rise` 逐格定高
 （74＋n×54px，行 44＋gap 10），脱离流；关闭态容器只剩 64px 啤酒，
  真正贴角。容器 flex／column-reverse／transition-bottom 全删。
- 铁律：收起态的占位和展开态一样要验——藏起来的东西也在撑高度。

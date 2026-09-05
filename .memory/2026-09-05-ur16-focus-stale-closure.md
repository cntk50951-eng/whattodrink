# 2026-09-05 — UR1.6：Leaflet 回调闭包过期＋lint 零容忍

## 情境
- UR1.6 点他人 pin 要读实时定位做 fitBounds。marker 回调在只跑一次的
  init effect 里注册，自然写成闭包读 `geoStatus`／`geoPosition`。

## 问题
- 两连击：1）闭包捕获的是首 render 的 geo（idle／null），之后定位再变，
  点 pin 永远走“无定位”分支——必现的功能性 bug；
  2）把 `handleFocusPerson` 声明在 effect 后面，lint 报
  `Cannot access variable before it is declared` error，挡住 gate。

## 原因
- Leaflet 回调活在 React 渲染周期之外：注册一次、调用 N 次，
  闭包里的 render 值全部过期。function 声明 hoisting 让运行时不崩，
  但 lint 照样判死刑——gate 要的是零 error，不是“能跑”。

## 修正
- Neu 模式：`geoRef` 存最新 geo，effect 内 `marker.on("click", ...)` 调的
  handler 只读 ref；ref 用独立 effect 同步（不在 render 里写）。
- 函数声明移到 init effect 之前，一劳永逸过 lint。
- 距离显示反而不需 ref：卡片是正常 render 输出，直接读 `geoPosition`，
  每次 watch 更新自然重算——render 内的值永远新鲜，只有逃出 render
  的回调才需要 ref。判断标准：代码跑在 render 里还是回调里。

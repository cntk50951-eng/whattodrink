# 2026-09-05 — localStorage 懒读引发 hydration 崩＋dial 藏卡片后

## 情境
- 啤酒按钮静默期用 lazy useState initializer 读 localStorage（为过 lint）。
  用户报 hydration mismatch：服务端 span fabPing，客户端 svg。

## 问题
- 两个：1）服务端无 window 回默认值、客户端读到真值，首屏不一致必崩；
  2）用户说按钮“从没到过左下角”——其屏幕上一直有底部卡片展开，
  dial 按旧设计浮在半空（lifted），用户视角里它就没下去过。

## 原因
- lint 过了不等于 SSR 对：localStorage 是外部可变数据，render 里读它，
  服务端和客户端天然分叉。之前修 theme-provider 同 pattern 时没爆，
  只是因为 LOCKED_THEME_ID 锁死让两端恰好一致，雷还在。
- lifted 设计和用户“钉死左下角”的指令根本矛盾：有卡必浮空。

## 修正
- 静默期改 useSyncExternalStore（server 快照恒 false，首屏两端一致；
  同 tab 写后靠本次重渲染读新快照，跨 tab 靠 storage 事件）。
  theme-provider 暂不动（锁生效中无 bug），解锁前必须同改，已记事项。
- dial 行为改隐藏：卡片展开时整个 dial return null，关卡即回；
  删掉 fabLifted（无死代码）。backlog UR1.4 同步。

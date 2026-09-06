# 2026-09-05 — UR2.1：React 19 规则双杀＋几何进 lib

## 情境
- UR2.1 打卡面板从底部改贴 pin 浮层：屏幕投影＋翻面＋拖图关。

## 问题
- 连撞两条 React 19 lint 铁律：1）render 里读 `mapRef/holderRef`
  （`refs-in-render` error）；2）直接修会掉进 `set-state-in-effect`。
  第一版还多写了一套全局 move 监听＋tick，拖图空转 60fps 重渲染。

## 原因
- Leaflet 是命令式世界，React 19 规则假设声明式：投影点这种
  “外部系统的当前值”必须住 state，用订阅同步，不能 render 现读。

## 修正
- 投影点进 `view` state：卡开／fix 变／mapReady 时 microtask 快照首帧，
  相机 `move` 事件续投影；订阅只在卡开时存在，裸拖零重渲染。
  面板高度用 callback ref 量（非 effect，规则静默）＋按卡 remount 重量。
- 纯几何（翻面／收边／尾巴）抽 `lib/anchor.ts`＋5 单测；
  组件只剩投影＋样式。
- Step 9b：零新增数据字段，数据文档无需更新（留痕备查）。

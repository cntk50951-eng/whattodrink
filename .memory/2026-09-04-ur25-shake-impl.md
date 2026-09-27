# 2026-09-04 UR2.5 搖一搖实作记录

- 范围：UI 先行。`lib/shake.ts` 纯函数选中（haversine＋24h 窗口）＋4 单测；
  `hooks/useShake.ts` devicemotion 双跃变判定＋3s 冷却＋iOS 权限；
  MapFab 右侧摇摇 pill 按钮（Vibrate 图标＋虚线边框区别于旧 hint，
  首屏新人仍先看旧啤酒引导）；5min 抖一次，quiet key 独立（`wtd-shake-used`，
  按摇摇使用算——啤酒点得多不影响发现机制）；涟漪 650ms＋复用
  handleFocusPerson；空／无定位／权限拒绝三 toast；reduced-motion 跳涟漪。
- mock 加 `checkedInAt`（相对模块加载时间，不会过期）；Mandy 故意 26h 证明过滤。
- 踩坑两则：
  1. `fabShake` 和 `fabHint` 都是 `animation` 属性——同元素挂两个类时后定义的
     赢，抖动会被 nudge 覆盖。解：三元只挂一个类（wobble ? fabShake : fabHint）。
  2. `react-hooks/refs` 禁 render 里写 ref：`cbRef.current = onShake` 改放
     useEffect（无依赖，每 render 同步）。
  3. `useRef<ReturnType<typeof setTimeout>>` 配 `window.setTimeout` 在本仓 tsc
     下打架（node Timeout vs DOM number）：timer ref 直接用 `number`。
- 未验证：AC2 真机摇动（桌面无 devicemotion）、iOS 权限弹窗、5min 抖动
  （需等或临时改间隔）。浏览器验收后才可 commit。
- 门：tsc 净／lint 0 error／vitest 48/48（7 文件）。

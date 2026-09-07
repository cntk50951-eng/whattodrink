# 2026-09-07 UR2.9 摇一摇手感（rattle＋prime＋真震动）

## 情境
- 用户：摇一摇动画没感觉，手机不震。实测根因：`navigator.vibrate`
  一次都没调过（只有 Vibrate 图标）；物理摇动在结果前零反馈。

## 问题
- React 19 `refs` lint error：`burstTimer.current` 在 cleanup effect 里
  读过，`bumpBurst` 里再写即错（"value used in effect 不许别处改"，
  toastTimer 因只在 mount 读一次逃过）。

## 原因
- ref 又当跨渲染计时器又进 cleanup——读写两头堵是既定规则，
  不是误报。

## 修正
- 删 `burstTimer` ref：`bumpBurst` 只 `setShakeBurst(b+1)`；
  归零走 `useEffect([shakeBurst])`（600ms timeout，cleanup 自清，
  连击自动顺延；async continuation 写 state 合规）。
- 本轮实现备忘：`.fabRattle` 横向衰减抖（key 重挂重播，和 fabShake
  三元互斥，reduced-motion 关）；`useShake(…, onPrime?)` 第一晃 tick
  （冷却内不触发）；`lib/haptics.ts`（FOUND／MISS／PRIME 三震型，
  无 API 回 false）；iPhone Safari 无 vibrate 是系统限制，动画补偿。
- 门：62 tests／tsc 净／lint 0 error。9b：零新增数据，无需更新。

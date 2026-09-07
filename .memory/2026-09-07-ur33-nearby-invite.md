# 2026-09-07 UR3.3 附近在线＋约喝酒（用户拍板 A 四态）

## 情境
- 用户要求：先思考要不要后端＋skill 深度设计＋向他确认，再开工。
  照做：结论（presence／邀约状态机必须后端，UI 先行 mock）＋四态案
  经 AskUserQuestion 拍板；另起 design 子代理印证（结论一致）。

## 问题
1. 加 `Checkin` 字段炸 `shake.test.ts`（fixture 手写全量对象）。
2. render 内 `Date.now()` 撞 impure lint（含组件内普通函数＋JSX）。
3. en 文案 `It's on!` 的单引号会被 ICU 当引用符吃掉。

## 原因
1. 手写 fixture 是全量字面量，加字段即炸——可预见的耦合。
2. 规则看位置不看意图：组件体函数／JSX 内调 impure 即错，
   effect／事件回调内可调。
3. ICU MessageFormat 单引号语义，写 en 文案的固定坑。

## 修正
1. fixture 补两行；`checkins.test.ts` 泛型循环补两行断言（UR2.0 口径）。
2. now 快照：mount microtask 取一次（mock 种子同代，整会话不漂）；
   `renderOthersPins(map, L, now)` 调用点传参；`handleInvite` 守卫走快照；
   `inviteFx` 的 key 直接删（pending 分支挂载即重播，不需要）。
3. 改词（Deal!），以后 en 文案禁裸单引号。
- 门：72 tests／tsc 净／lint 0 error。9b：future-schema＋home-map。
- 返工（用户：在线 pill 丑）：双 pill 并排＝贴纸打架；状态退一级——
  只留性别 pill，在线用“绿点＋绿字” inline 跟区名后。教训：同行最多
  一枚重型 pill，次要状态用轻量 inline。

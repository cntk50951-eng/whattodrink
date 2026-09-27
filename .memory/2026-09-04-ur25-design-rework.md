# 2026-09-04 UR2.5 设计返工（design-taste-frontend skill，redesign-preserve）

- Design Read：地图 speed-dial 的 companion 控制，沿用站内 doodle 语言，
  只加一处现代动作点缀。Dial：沿用现有，motion＋1。
- 用户原判：虚线 pill 与啤酒钮出入大；单环涟漪不现代。
- 改法：
  1. 摇摇 pill → 48px 卫星圆钮（card 底＋品牌色 Vibrate 图标＋ink 边＋3px 硬阴影），
     尺寸卡在啤酒 64 和扇形 44 之间，同一圆钮家族、反转极性分主次；右边留小字
     静态说明（去虚线、去无限 nudge，动作只发生在钮上）。
  2. 单环 → 声纳三层：中心软闪 0.45s＋主环＋0.28s 后追逐的第二环，
     cubic-bezier(0.16,1,0.3,1)，只动 transform／opacity；JS 卸载 650→1250ms
     对齐第二圈走完（注释和 backlog 同步改，旧数字是坑）。
  3. toast 加 fabBubblePop 入场（复用，不新造 keyframes）。
- 审计结论：无新色（doodle-red＋card＋ink）、无新依赖（motion/GSAP 不值得为
  两处动效引入）、深浅色通吃（全走 token）、reduced-motion 三层全关。
- 门：tsc 净／lint 0 error／48 tests。待用户浏览器亲眼确认。

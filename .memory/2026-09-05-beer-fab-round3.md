# 2026-09-05 — 啤酒 FAB 第三轮：闲置唤醒＋搬左下

## 用户需求
- 3 秒无点击 → 啤酒摇晃一下；20 秒无操作 → 弹漫画气泡（“点我喝一杯”）。
- 点过之后 12 小时不再出现。
- 按钮搬左下角，问是否更符合阅读习惯、更容易发现。

## 设计决策
- 同意搬左下：右下挤着 OSM 归属行，且右列是地图原生控件位，主按钮放
  那里容易被当成“地图自带”而忽略；左列是 LTR 视觉起点，发现感更强。
  代价：MOCK badge 从左下搬到左上（已办）。
- 摇晃只播一次（0.55s×3 遍后静止），不做循环骚扰；气泡出现后取代小 pill
  （不叠加）；任意 pointerdown 重置计时；扇形打开时不弹气泡。
- 静默期用时间戳 `wtd-fab-tap` 存 localStorage（旧 `wtd-fab-hint` 作废，
  残留无害）。lint 教训：render 里 `Date.now()` 被 react-hooks/purity 拦，
  用 lazy useState initializer 包起来（和 localStorage 同 pattern）。

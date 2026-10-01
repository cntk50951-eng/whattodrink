# 2026-10-01 — UR C.22 黑底揭曉 overlay（实作完待验）

## 情境

- 用户：点霓虹 CTA 开深色 overlay 随机 show 酒照（现只有 1 张 GIF，验证后再加）。问答定案：取代 Sheet＋关闭三路（背景／X／主鈕）＋照片放 `components/drinks/`。
- 交接：`components/drinks/` 原本不存在，用户随后放入 `sapporo_commercial_9x16_no_loop.gif`（3.7MB，9x16 竖幅动图）。

## 问题

1. GIF 动画怕被 `next/image` 优化管线杀掉——标准解法 `unoptimized`（保原图直出）。
2. `openPick` 另有两处调用（pills 选酒鈕＋2189 行）：改道只动霓虹中央鈕，另两处沿旧 Sheet 链当退路（plan 内定，未再问）。
3. 全仓 lint 既有 `V2GatheringForm.tsx` 1 error（未碰）；`.env.example` 真 secrets 仍在工作树（未碰，持续排除）。

## 原因

- `unoptimized` 是 GIF 动图的常规做法（优化器会重编码丢帧）。
- index 在 `openReveal`／`onReshuffle` 里抽、存 state——render 内抽每次渲染都变，照片闪烁。
- 空池回 -1 而非抛错：将来池管理出问题时 overlay 保持关闭，不白屏。

## 修正

- `components/drinks/gallery.ts`（`{src, altKey}` 池＋`revealPhotoAt` 越界回首张）＋`lib/reveal.ts`（`pickRandomIndex`）＋5 单测＋`V2RevealOverlay`（dialog＋Esc＋三路关＋主鈕再抽；9x16 `object-contain`；无进场动画，reduced-motion 天然合规）。
- `V2Home`：state×2＋`openReveal`＋霓虹改道＋overlay 挂载；`revealTitle/Again/Close/PhotoAlt1`×3 同序。
- 验证：`vitest` 5 绿／`eslint` 5 档净／`build` exit 0／`git status` 无 v1；待用户浏览器亲验（黑底／竖图置中／三路关闭／再抽＋手机 viewport），未提交。

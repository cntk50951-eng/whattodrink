# 2026-10-12 — UR I.1 AI 质量（探针驱动：稳定＋護欄＋规则写死）

## 情境

- iOS 用同 prompt＋同模型本地探针：无 temperature 故同输入多结果；泛指乱填整组；"左右"当精确。

## 问题

- minimaxChat 无 temperature 透传；sanitize 只做形状，不管"整组乱填"语义噪音。
- "女生却见粤语年龄"探针未复现（iOS 侧旧结果串扰，已修），web 侧无需改。

## 原因

- 规则只放心里，没写进 prompt；少样本零条。

## 修正

- minimaxChat 加 temperature／top_p（默认不传，旧调用零影响）；meet 解析 temperature 0＋top_p 1。
- dropNoisyGroups（taste≥5／interests≥6／occupations≥5 整组丢，LLM 路径专用）。
- prompt 硬规则 6 条＋7 条 few-shot；`notes[]`（距离在线／泛指略过）；`scripts/meet-regression.ts`（vite-node 手动跑，8 用例）。
- 判例：凡"模型偶发乱填"，先 prompt 写死，再代码護欄，最后回歸腳本锁死。

# 2026-09-05 — harness 常驻指令：开工记忆门禁＋改动回写 UR

## 情境
- 用户两条明确指示：1）每次他提新改动且完成后，回顾对应 UR 并补充
  改动描述；2）harness 必须控制：每次开工前回顾 memory，
  确保了解之前的错误、错漏、做得不好的地方。

## 问题
- 1）之前返工只写 CHANGELOG＋memory，backlog 的 UR 本体从不追加，
  后人看 UR 以为一次做成；2）AGENTS.md 的“开工读 memory”只是文字要求，
  没有执行点和报备动作，compaction 后全靠自觉（UR1.4 就裸奔过半段）。

## 原因
- 要求没有落进 workflow 的 step＋checklist，就等于没有要求；
  报备动作缺失则无法自查是否执行。

## 执行（已落地 .harness/workflow.md）
- Step 1 开工门禁：24h 新增全读＋近 3–5 条，首轮实质回复中报备
  （读了哪几篇＋哪条本轮生效），没报备不许进 Step 4；compaction 后首动重读。
- Step 7 改动回写：用户改动完成后回 UR（范围／AC 同步＋`*改動記錄*`
  日期＋改什么＋为什么）＋CHANGELOG fix 行＋memory，三处互索引；
  checklist 两项同步加勾。
- 本轮已示范：UR1.8 补两条、UR2.0 补一条改動記錄。
- 此条为常驻指令：后续每轮首轮回复即报备，不再另记。

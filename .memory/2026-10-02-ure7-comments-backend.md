# 2026-10-02 — UR E.7 留言（后端三端点＋V2Comments）

## 情境

- E.7 开工（v2-only，匿名可留＋回前限1＋审核沿 E.2），走 api-workflow 一次一个端点。

## 问题

1. `write` 整档覆盖把刚写好的 GET 冲掉（想要 append 却用了 write）。
2. POST 初版留了 `replyMs` 死查询＋`void replyMs` 浆糊（作者回复判定绕了两圈）。
3. `apiOk(data, 201, headers)`——envelope 签名只有两参，Set-Cookie 塞不进去。
4. `react-hooks/set-state-in-effect`：V2Comments mount effect 内同步写 state（切帖重置四连）。

## 原因

1. write 即全量覆盖，无 append 语义——同一文件第二轮写必须 read＋edit。
2. 单层结构无线程归属，作者回复只能按帖级从宽（首评后作者任何回复即清零），想精确就得加 parent 列（非 MVP）。
3. envelope 是 vendored 契约，不扩签名（加法也别碰，用原生 Response.json）。
4. effect 内同步 setState 即 cascading renders，lint 比人眼可靠。

## 修正

- GET＋POST 同档重写干净版（loadPost／gateNonPublic 共用 helpers；service 旁路 RLS＋应用层 canViewCheckin，沿 D.2 口径）。
- Set-Cookie 走 `Response.json({comment}, {status: 201, headers})`。
- 切帖重置搬进 `load(append=false)`＋effect 内 `queueMicrotask` 包（沿 UR3.0 配方）。
- 验证：匿名 POST 201＋cookie、次条 429、前 400——真库实测；测试行已清。

# 2026-10-08 — E.24 round-2：GDELT 免费额度连打吃 429＋RSS 不猜

## 情境

- 用户 concern 酒闻源不够，加源。候选：VinePair／Drinks Business RSS 直连＋GDELT 加 query。

## 问题

1. DB `/feed/` 返回 HTML（无 RSS）；猜深路径（`/news/feed/` 类）违反"不猜 URL"。
2. GDELT DOC 免费口连续调两条即 429（第一条 200 带标准形，第二条 429）。

## 原因

- 不是所有 WordPress 站都开 `/feed/`；feed 是否存在必须实测（200＋有 `<item>`）才收录。
- GDELT 免费 tier 对连打敏感；batch 内多 query 必撞。

## 修正

- 收录原则：RSS 实测活才直连（VinePair 过，DB 不过改走 GDELT `domain:` 查询；C2/C3 域名靠搜索确认 winesinfo.com／wbo529.com，不猜）。
- `fetchGdelt` 改逐条 try/catch＋条间 800ms（单条挂不丢整批好行；全空才降级 G2）。
- GDELT query 噪声大（"wine Hong Kong" 回台 KTV 文），地域 query 尽量加 `sourcecountry:`＋中文 topical 双轨。

## round-4 追記（500 无 stack 定案）

- 现象：r3 诊断版只打出首行 log 即无后文，刷新后 log 清空；500 无任何 app stack。
- 定案：长链（3 RSS 串行＋7 GDELT 串行＋间隔＋429 拖时）跑超平台单次时长被杀——杀掉的执行不留 app 报错，只有无 stack 500。
- 修法：RSS 三源 `Promise.allSettled` 并行＋GDELT 按 UTC 小时轮换（`gdeltQueryRotation`，半量／轮＋首条保底，单条最长 4h 一次）＋45s 软预算（超了跳过剩 query＋G2 门）＋间隔提到 1500ms。
- 另：单测写错一次（`gdeltQueries()` 每次新建对象，Set 去重要按 `q` 字符串比，不能按引用）——实现对，改测试。

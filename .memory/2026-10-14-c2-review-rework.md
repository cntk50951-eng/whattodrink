# 2026-10-14 — C2 后台详情返工（DEF-20261014-001／002）

## 情境

- 用户报投诉详情两问题：时间线／AI 整块 JSON（要结构化＋双方身份＋截图）；点执行跳 404 处理无效。

## 问题

1. 时间线／AI 两段 `JSON.stringify` 直出；`filer_id／target_id` 从不展示。
2. 执行 404：`decide` 经 `requireAdminPage`，守门失败（会话过期 none／viewer forbidden）即裸 `notFound()`，零信息。
3. 修法时 TS CFA 不认 never-returning 箭头函数（`back()`）做收窄／定值分析；另误伤 `evidencePathAllowed` 换行一次（即时恢复，零 diff）。

## 原因

1. 详情页 MVP 只求有，后台展示未结构化。
2. 门禁用了抛（notFound／throw）语义，Server Action 里失败无处显字。
3. 本仓 TS 版本下，`throw` 可收窄而 never-调用不可（`!==` 字面量排除＋守卫收窄全灭）；edit 锚行贴着函数头时易吞换行。

## 修正

- `decide` 改直调 `adminGate`（只返回不抛）：need 系去 MFA，其余 `?err=` 回页顶横幅（13 码全进 `DECIDE_ERR_TEXT`）；`notFound` 仅留真空行。
- 详情加双方区（service 查昵称，陈述仍甲乙匿名）＋事件中文标签＋到场房主标记＋AI 分字段＋证据空态明示。
- TS：`if (!x) { back(); throw new Error("unreachable"); }` 显式收窄；`as Decision`＋注释代替排除收窄。
- 判例：Server Action 失败展示一律用 `?err=` 回跳，不抛；edit 锚行离函数声明至少空一行。

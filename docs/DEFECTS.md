# DEFECTS — 统一缺陷管理

> 单一真相文档（Muse / Claude 双 harness 共用，见 `.harness/workflow.md` Step 7b）。用户提出 defect 关键词时当轮落条，Fix 关联 UR 走完整 10 步。

## 字段模板

| 字段 | 说明 |
|---|---|
| ID | `DEF-YYYYMMDD-001` 递增 |
| 标题 | 一句话概括 |
| 状态 | `Open → Investigating → Fixing → Fixed → Verified → Closed` |
| 严重度 | `P0 阻断 / P1 主要 / P2 次要` |
| 发现日期 / 报告人 | `YYYY-MM-DD / @who` |
| 复现步骤 | 1. 2. 3. ... 可复现的最小路径 |
| 期望 vs 实际 | 期望行为 vs 实际行为 |
| 初判根因 | 收到上报时的第一判断（可填 待确认） |
| 确诊根因 | 排查后确认的根因（含文件:行与证据） |
| 关联 UR | 修复所关联的 UR 编号（新建 `fix/defect-xxx` 或复用） |
| 修复验证 | 自动化/手动验证方式与结果 |
| 回归范围 | 影响面与回归用例 |

---

| ID | 标题 | 状态 | 严重度 | 发现日期 / 报告人 | 关联 UR | 确诊根因 |
|---|---|---|---|---|---|---|
| DEF-20250925-001 | 登出→重登录后打卡酒类消失，不再显示 | Closed | P0 | 2026-09-25 / @yuki | UR A.10 / fix/defect-20250925-001 | DB FK 缺 public.users 行 + 前端回显缺 INITIAL_SESSION（见详情，已验证） |

### DEF-20250925-001 登出→重登录后打卡酒类消失

- **状态**：Closed（2026-09-26 用户验证通过，已合入 main）
- **严重度**：P0 阻断（核心链路：打卡是 EPIC 1.0/3.0 主链）
- **发现日期 / 报告人**：2026-09-25 / @yuki
- **复现步骤**：
  1. 登录后通过 `今晚飲咩？` 选酒并打卡（`POST /api/v1/checkins` 201）
  2. 登出（`HeaderAuth` → `clearUserLocalCaches` + `LOGOUT_CLEAR_EVENT`）
  3. 重新登录（`signInWithOAuth` → `/auth/callback` → 回 `/`）
  4. 观察 `DrinkMap` 我的打卡/足迹与 `GET /api/v1/checkins/mine` 是否回显
- **期望**：重登录后 `DrinkMap` 应通过 `GET /api/v1/checkins/mine` 回显历史打卡（`WantRecord` 列表与地图 pin）
- **实际**：页面不显示任何打卡，疑似前端未展示或 API 未返回，或数据已被清
- **初判根因**：待确认 — 可能性：A) 前端 `LOGOUT_CLEAR_EVENT` 清理后未在重登录时重新 `fetch /mine`；B) `/mine` RLS/索引/时间过滤（`kind/expires_at`）导致已打卡被过滤；C) 登出时误删 DB 或 `clearUserLocalCaches` 误删持久化键
- **确诊根因**：**主因 DB FK（P0）**：`public.users` 缺行导致 `POST /api/v1/checkins` FK `23503`（`checkins_user_id_fkey`）失败后前端回退 `localStorage`，登出 `clearUserLocalCaches` 清本地即丢失；线上 `auth.users` 有 2 行（`testcheckins+…` 与 `cntk50951@gmail.com 424cfb87…`）而 `public.users` 仅 1 行（缺 Google 账号），`service` 直查 `checkins` 仅 3 行且全为 `private/flash` 旧测数据，`cntk50951` 无任何落库。根因是 `0006_auth_users_trigger_rls.sql` 的 `handle_new_user` 触发器未在 Google 账号创建前生效（该账号 `2026-09-23T15:25:46Z` 早于 0006 重放），需回填。**次因前端**：`DrinkMap.tsx:1101` 仅监听 `SIGNED_IN`，漏 `INITIAL_SESSION/TOKEN_REFRESHED` 且无 `isAuthed` 兜底，`USER_CACHE_KEYS` 未含 `wtd-pending-checkin`。
- **关联 UR**：UR A.10 打卡落库＋二次登录回显（原 WIP）/ 新建 `fix/defect-20250925-001` 走 10 步
- **修复验证**：`TSC 0 / lint 0 err / test 210 / build 30 页` 全绿；`DrinkMap` 扩 `onAuthStateChange` 至 `SIGNED_IN|INITIAL_SESSION|TOKEN_REFRESHED` + `useEffect [isAuthed true]` 兜底；`lib/auth/clear.ts` 补 `wtd-pending-checkin`；`app/api/v1/checkins` 补 `users` 缺行自动创建（`POST` 前 `select→insert`）；`service` 回填 `424cfb87… CnTK` 后 `POST flash/post` 均 `201 public`（`flash expires_at+24h`/`post null`），`GET /mine` 与 `select … order by created_at desc limit 10` 已见新 `public` 置顶；2026-09-26 用户 `fix了` 确认
- **回归范围**：`POST /checkins` 403 stealth、`kind` 双类型、`pins range`、`LOGOUT_CLEAR_EVENT` 清理、`WantRecord` 解析

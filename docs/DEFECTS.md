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
| DEF-20250925-001 | 登出→重登录后打卡酒类消失，不再显示 | Fixed | P0 | 2026-09-25 / @yuki | UR A.10 / fix/defect-20250925-001 | 前端回显缺 INITIAL_SESSION + isAuthed 兜底 + pending 未清理（见详情） |

### DEF-20250925-001 登出→重登录后打卡酒类消失

- **状态**：Fixed（已修复，待 Verified/回归）
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
- **确诊根因**：前端 `DrinkMap.tsx:1101` 的 `onAuthStateChange` 仅监听 `SIGNED_IN`，遗漏 `INITIAL_SESSION/TOKEN_REFRESHED`（重登录经 OAuth 回调 + 页重载后为 `INITIAL_SESSION`，且 `getUser` 首轮可能为 null 时无兜底），导致登出清空 `wantHistory` 后重登录未触发 `fetch /mine` 回显；另 `lib/auth/clear.ts` 的 `USER_CACHE_KEYS` 未含 `wtd-pending-checkin`，旧 pending 跨会话残留风险。DB 侧 `POST /mine` 均正常（`visibility` 不过滤、`kind` 兼容 `42703` 回退已验证），属前端问题。
- **关联 UR**：UR A.10 打卡落库＋二次登录回显（原 WIP）/ 新建 `fix/defect-20250925-001` 走 10 步
- **修复验证**：`TSC 0 / lint 0 err / test 210 / build 30 页` 全绿；`components/map/BeerIcon.test.ts` 5 测；`DrinkMap` 扩 `onAuthStateChange` 至 `SIGNED_IN|INITIAL_SESSION|TOKEN_REFRESHED` + 新增 `useEffect [isAuthed true]` 兜底回显（仅当 `parsed.length !== wantHistoryRef.current.length` 时覆盖，避免抖动）；`lib/auth/clear.ts` 补 `wtd-pending-checkin` 至 `USER_CACHE_KEYS`，登出残留已清；`curl /api/v1/checkins/mine?limit=30` 倒序含 `kind/visibility/expires_at`，前端 `mineRowToWantRecord` 容错后升序回显最新
- **回归范围**：`POST /checkins` 403 stealth、`kind` 双类型、`pins range`、`LOGOUT_CLEAR_EVENT` 清理、`WantRecord` 解析

---
name: harness-workflow
description: "whattodrink project development workflow — use at the start of every development task. Triggers on 'start task', 'begin work', 'new feature', 'fix bug', or any coding session. Enforces the 10-step process and harness rules."
---

# Harness Workflow — whattodrink

At the **start of every development task**, follow these steps strictly:

## Mandatory pre-reads (Step 1)

1. `.harness/workflow.md` — 10-step development process
2. `.harness/coding-standards.md` — TypeScript / React / file structure / naming
3. `.memory/` — read latest 3–5 entries (if new entries exist in last 24h, read ALL of them)
4.依任務性質再讀 `.harness/` sub-files: `testing.md` / `git.md` / `architecture.md` / `api-workflow.md`（API 任務必讀，七步一次一個端點）

(Muse tool note: load another skill's full instructions with the `read_skill` tool using its id or path from the skills catalog — never `read_file` a `bundled://` or `plugin://` path.)

## Hard rules

- **Never auto commit / push** without user confirmation (Step 10)
- **V1/V2 isolation (EPIC C, hard rule, both directions)**: v2 work never modifies v1 files (routes/pages/components/styles/i18n keys); v1 keeps iterating freely; shared-layer (`lib/`/`hooks/`/API) changes must stay backward compatible (additive only) + pass v1/v2 dual regression. See `.harness/workflow.md` Step 4 (V1/V2 isolation) + backlog EPIC C.
- **UI changes**: 由用户自行在浏览器验证，OpenCode 不自动执行 agent-browser / playwright 截图（Step 10a–10b 由用户手动完成）
- **New lib / new version**: look up the latest API first via `mcp__context7__resolve-library-id` + `mcp__context7__query-docs` (Step 3), never rely on training data
- **Logic errors**: fix immediately, then re-run Step 3→7
- **Defect 统一管理 (Step 7b)**: 用户提出 defect 关键词时，必须先在 `docs/DEFECTS.md` 按模板落条（ID/标题/状态/严重度/复现/期望-实际/根因/关联 UR）并走 `Open → Investigating → Fixing → Fixed → Verified → Closed` 流转；Fix 必须新建关联 UR 并走完整 10 步（同样需 gates/浏览器/CHANGELOG/memory），禁止跳过文档直接修
- **UI design changes**: if Step 3.5 conditions hit (new page / redesign / tokens / animation), load the design skill first via `read_skill` (`stitch-design` / `design-taste-frontend` / `taste`) — brand layer (doodle) is locked, see `workflow.md`
- **Every fix / user correction / toolchain issue**: write a memory entry (Step 8)

## Environment

- Node 22+: always prefix bash with `export PATH="/Users/yuki/.nvm/versions/node/v22.22.0/bin:$PATH"`
- npm (no pnpm)
- No gh CLI — use GitHub API + curl (see the `github-api` skill)

## Step 10 summary (pre-commit) — 分工：agent 跑 gates，用戶驗瀏覽器

```
1. agent 先跑三閘全綠（見 Pre-commit gates，不跳過）
2. 提示用户自行启动 dev server 并打开 http://localhost:3000/ 验证（agent 不自动执行 agent-browser / playwright 截图，Step 10a–10b 由用户手动完成）
3. 等待用户在浏览器亲眼确认「OK 可以 commit」或具体修改指示
4. request_user_input 拿最终 commit 确认
5. 才执行 git commit + git push
```

Exception: 纯文档 / config / refactor（无 UI 变更）可跳過第 2–3 步，但仍需 4–5。

## Pre-commit gates — agent 照跑，不跳過

- `npm run build` — agent 跑（編譯＋型別檢查）
- `npm run lint` — agent 跑（ESLint 無 error）
- `npm test` — agent 跑（vitest 全綠；見 `.harness/testing.md`）
- 三道 gate 全綠才能交付；唯瀏覽器驗證交用戶手動（agent 不開瀏覽器）

Any commit with new logic **must** include corresponding unit tests (agent 寫＋跑；exceptions 見 `.harness/testing.md`).

## Safety

- Never hardcode `.env` content into shell commands, URLs, commit messages
- Extract API keys with `grep '^KEY_NAME=' .env | cut -d= -f2-` into shell variables
- Push with inline token URL, not `git remote set-url`

## Cleanup — end of every task

Before handing back, delete scratch files created during the task:

- `/tmp` probes and scripts (`/tmp/wtd-*.py`, `/tmp/check-*.js`, `/tmp/shot-*.png`, downloaded references like `/tmp/stitch-*.png`, `/tmp/stitch-last.json`)
- Any workspace scratch outside the deliverable scope
- Remove by exact path (`rm -f` the files you created); never wildcard-delete directories you don't own

Keep: deliverables, memory entries, CHANGELOG updates, and anything the user explicitly asked to keep.
Never delete: repo files outside the task scope, files from other sessions, anything you didn't create this session.

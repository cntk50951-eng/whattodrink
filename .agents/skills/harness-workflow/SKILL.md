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
4.依任務性質再讀 `.harness/` sub-files: `testing.md` / `git.md` / `architecture.md`

(Muse tool note: load another skill's full instructions with the `read_skill` tool using its id or path from the skills catalog — never `read_file` a `bundled://` or `plugin://` path.)

## Hard rules

- **Never auto commit / push** without user confirmation (Step 10)
- **UI changes**: after development, user MUST verify in browser before commit (Step 10a–10b)
- **New lib / new version**: look up the latest API first via `web_search` + `web_fetch` (Step 3), never rely on training data
- **Logic errors**: fix immediately, then re-run Step 3→7
- **Every fix / user correction / toolchain issue**: write a memory entry (Step 8)

## Environment

- Node 22+: always prefix bash with `export PATH="/Users/yuki/.nvm/versions/node/v22.22.0/bin:$PATH"`
- npm (no pnpm)
- No gh CLI — use GitHub API + curl (see the `github-api` skill)

## Step 10 summary (pre-commit)

```
1. Confirm dev server running (background task)
2. Open browser: open http://localhost:3000/ or provide URL
3. Wait for user to visually verify in browser
4. Wait for user to say "OK 可以 commit" or give changes
5. request_user_input for final commit confirmation
6. Only then: git commit + git push
```

Exception: pure docs / config / refactor (no UI change) can skip steps 2–3, but still 4–6.

## Pre-commit gates

- `npm run build` — compilation + TypeScript type check
- `npm run lint` — ESLint
- `npm test` — vitest (if installed; see `.harness/testing.md`)

Any commit with new logic **must** include corresponding unit tests. Exceptions in `.harness/testing.md`.

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

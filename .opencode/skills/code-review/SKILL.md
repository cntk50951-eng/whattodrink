---
name: code-review
description: "Pre-commit self-review checklist for whattodrink. Use before every commit to verify build, lint, test, coding standards, and harness compliance."
---

# Code Review — whattodrink

Before every commit, run through this checklist:

## Gates — OpenCode 由用户手动执行（不自动自测）

1. **TypeScript**: `npm run build` 由用户本地跑（OpenCode 不自动执行）
2. **ESLint**: `npm run lint` 由用户本地跑
3. **Unit tests**: `npm test` 由用户本地跑（见 `.harness/testing.md`）

## Code standards (from `.harness/coding-standards.md`)

- `strict: true` — no `any`, use `unknown` then narrow
- Server component by default — no `"use client"` unless state/effect/event/browser API
- Type-only imports: `import type`
- No magic numbers — extract to constants
- No `console.log` in production code
- No `// @ts-ignore` — use `// @ts-expect-error` + comment
- Import order: Node built-in → external → `@/` alias → relative (blank line between groups)

## Layout primitives

- All layout components (`Container` / `Section` / `Grid` / `Stack`) **must** support responsive variants
- Type: `type Responsive<T> = T | Partial<Record<"base" | "md" | "lg", T>>`
- Token range: `0/1/2/3/4/6/8/10/12` (all included)

## base-ui patterns (from `.memory/`)

- DropdownMenuTrigger: use `className` directly, not `render={<Button>}`
- Label / Separator / Items must be wrapped in `<DropdownMenuGroup>`
- Button: add `nativeButton={false}` when using `render={<a>}` prop

## Security

- `.env` never in source code, commit messages, or shell commands
- API keys extracted via `grep` + `cut`, stored in shell variables
- Tokens pushed via inline URL, not git config

## Documentation

- `CHANGELOG.md` updated (Added / Changed / Fixed / Deprecated / Removed / Security)
- Memory entry created if any fix or lesson learned (`.memory/YYYY-MM-DD-<slug>.md`)

## Commit message (from `.harness/git.md`)

- Format: `<type>(<scope>): <subject>`
- Type: feat / fix / refactor / chore / docs / test / style / perf
- Subject: Chinese or English, < 50 chars, no period, verb-first
- Footer: `Refs: #123` if applicable, exception tags if needed

## Browser verification — OpenCode 不自动执行

- UI 变更由用户自行在本地浏览器验证（OpenCode 不使用 agent-browser / playwright 自动截图）
- 静态布局由用户 `npm run build` 通过即可（仍需用户亲眼确认）

---
name: code-review
description: "Pre-commit self-review checklist for whattodrink. Use before every commit to verify build, lint, test, coding standards, and harness compliance."
---

# Code Review — whattodrink

Before every commit, run through this checklist:

## Gates (all must pass)

1. **TypeScript**: `npm run build` passes (type check + compilation)
2. **ESLint**: `npm run lint` no errors
3. **Unit tests**: `npm test` all green (if vitest installed; see `.harness/testing.md`)

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

## Browser verification (from Step 6)

- UI functionality → use the agent-browser skill to screenshot mobile + desktop viewports
- Static layout only → `npm run build` pass is sufficient (but still need user visual confirmation)

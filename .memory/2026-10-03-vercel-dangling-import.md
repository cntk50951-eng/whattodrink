# 2026-10-03 — Vercel 连红两单：dangling V2Comments import（半截提交重演）

## 情境

- Bell 车推上 main 后远端无 Bell：GitHub 有码（`8f36551`），Vercel `d6063f6`／`8f36551` 两单 failure，远端跑 `1a192eb` 旧包。Vercel 日志：`V2Home.tsx(48,28): TS2307: Cannot find module '@/components/v2/V2Comments'`。

## 问题

- `origin/main` 的 `V2Home.tsx:48` 有 `import { V2Comments }`，但 `V2Comments.tsx` 从未进仓（teammate E.7 的 untracked 文件）。本地 tsc 绿（工作区有文件），Vercel 干净检出必炸。
- `d6063f6` 的 V2Home diff 把工作区里 teammate 的 import 行顺手带入——DEF-20260926-016 图标半截提交（tracked 改动交了、新文件躺 untracked）同一病，本轮重蹈。

## 原因

- `git diff` 按行不认“归属”：同文件的两家 hunks 混在一起，整文件 `git add` 即顺手合入别家行。上次 Bell 提交只切了 usage hunks，漏审 import 行（`grep V2Comments` 本可一秒定罪）。

## 修正

- hotfix：删 main 内零引用的 dangling import 一行（`V2Home.tsx:48`；工作区不动，teammate 的 import＋usages＋文件留给 E.7 车）。
- 教训：凡提交触碰多人共写文件，`git add` 前 `grep` 新符号在仓内有无定义文件（`git ls-tree`），无定义即半截提交，当场修。

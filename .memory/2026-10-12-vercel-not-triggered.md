# 2026-10-12 — 线上 404：Vercel 没触发 f222e3a（不是构建失败）

## 情境

- App 调 `/api/v1/meet/*` 得 404（HTML），`/me`、`/friends/live` 正常。用户看到 Vercel 最新部署是 `c1cbb3a`。

## 问题

- 怀疑过三件事：推送没成功（已查：`ls-remote` 显示远端 main = f222e3a，成立）；构建红（已查：`git archive f222e3a` 干净目录 `next build` 退出码 0，路由表含 meet/search）；仓库忽略构建（已查：无 vercel.json／.vercelignore）。

## 原因

- GitHub commit statuses：f222e3a 之前的 11 次 push 每次都有 Vercel `success`；f222e3a **没有任何 Vercel 状态**。即 Vercel 从未对这次 push 开始构建（webhook 投递／集成层问题，代码无关）。

## 修正

- 无代码修正。需用户在 GitHub 仓库 Settings → Webhooks 看 Vercel webhook 的 Recent Deliveries（找 f222e3a 那次投递的状态码），或由用户确认后推一个触发提交。
- 复现方法（写给以后）：干净构建不要用 `ln -s node_modules`（Turbopack 报 "points out of the filesystem root"），用 `cp -cR node_modules`（APFS 写时复制）。`git archive <sha> | tar -x` 导出后，`.env` 另拷，`next build` 才能代表 Vercel。
- 判例：Vercel 的"没有部署"≠"部署失败"；先查 commit statuses（GitHub API `/commits/<sha>/statuses`），有无状态决定是触发问题还是构建问题。

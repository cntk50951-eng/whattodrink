# 2026-09-26 shadcn add 预览的工具链坑：rtk 前缀 + Node 版本

## 情境

跑 `shadcn add --all --dry-run` 预览时，连续 6 次失败：
`Unknown command: "shadcn@latest"`（npm 报错），以及一次
`ReferenceError: File is not defined`（undici 在 Node 18 下崩溃）。

## 问题

1. bash 命令带 `rtk` 前缀时，`rtk npx ...` 被转成 `npm ...` 执行，
   `npx --yes shadcn@latest` 变成 `npm shadcn@latest` → 未知命令。
2. 去掉 `rtk` 后裸调 `npx`，shebang 用 `env node` 解析到系统默认
   Node v18（非项目要求的 v22），shadcn 4.x 依赖的 undici 直接炸。

## 原因

- `rtk` 透传 `git/ls` 正常，但劫持 `npx`（疑似当成 npm 子命令转发）。
- AGENTS.md 要求每次非交互 bash 都 `export PATH=...node/v22...`，
  但那次调用漏了 export，npx 回落到 Node 18。

## 修正

- `npx` 相关调用**永不加 `rtk` 前缀**。
- 固定配方：`export PATH="/Users/yuki/.nvm/versions/node/v22.22.0/bin:$PATH" && npx ...`
- 更稳：直接用本地二进制 `./node_modules/.bin/shadcn add ...`，
  省掉 npx 下载，且版本与 lockfile 一致（本次预览即用此法成功）。

# 2026-10-08 — E.24：yaml 全文件已坏＋Deno 目录要排除 tsc

## 情境

- E.24 openapi 加段后，用 `js-yaml` 全文件解析验证，报 471 行缩进错；
  另新增 `supabase/functions/fetch-news/index.ts`（Deno），tsconfig `**/*.ts` 会把它卷进 tsc。

## 问题

1. 471 错在 HEAD 即存在（stash 验证），与本轮无关——全文件解析失败时看不出自己段落是否正确。
2. Deno 文件用 `Deno` 全局＋`https://` import，tsc 必红；eslint 也会扫到它（`_req` unused 一例）。

## 原因

- openapi 是多人追加的长文件，旧 breakage 无人发现（无 CI 校验）。
- tsconfig include 比 exclude 优先直觉弱：`**/*.ts` 无差别吞掉非 Next 代码。

## 修正

- yaml 验证法：全文件先对 HEAD 验（定基线）；自己段落抽出包最小 doc 独立 `y.load`（本轮 news path＋NewsItem 双过）。
  旧 471 不碰（非本轮范畴，已报备用户）。
- `tsconfig.json` exclude 加 `supabase/functions`（Deno 代码永不进 tsc；eslint 顺手把未用参清零 warning）。
- 约束候选：以后凡加 `supabase/functions/*`，同步检查 tsconfig exclude。

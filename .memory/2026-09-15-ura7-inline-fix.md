# 2026-09-15 UR A.7 inline bug 深排

## 情境
用户远端登录点击无网络请求，Console 报 `Supabase 未配置`，Vercel 已配三条 env 并重部署仍复现。之前误判为 env 未配，实际 Vercel 已配对。

## 问题
`lib/supabase/env.ts: requireSupabasePublicEnv(from = process.env)` 内部读 `from.NEXT_PUBLIC_*`。Next.js DefinePlugin 只会替换字面量 `process.env.NEXT_PUBLIC_*`，`from.NEXT_PUBLIC_*` 别名写法不会被 inline，production 浏览器 bundle 里 `from` 是空对象，永远抛缺失。本地 dev 能过是因为 Node 的 `process.env` 在 runtime 还在，production 才会挂——典型本地能跑线上挂。

## 原因
同上。`lib/supabase/client.ts` 在浏览器调用 `requireSupabasePublicEnv()` 无参，走别名路径。

## 修正
`requireSupabasePublicEnv(from?: EnvSource)` 拆两路：`from !== undefined` 时走 `resolveSupabasePublicEnv(from)`（测试用 mock）；`from === undefined` 时直接读 `process.env.NEXT_PUBLIC_SUPABASE_URL` 等字面量，让 Next.js 在 build 时 inline。保留 `resolve*` 供单测，184 tests / TSC_OK / lint 0 errors / build OK。推 `308e04d` 后需 Vercel 重部署。

## 教训
浏览器 env 必须写 `process.env.NEXT_PUBLIC_*` 字面量，不能包一层 `from` 别名。再写 env helper 要分 server-only 与 public 两个版本，且 public 版必须字面量读取。

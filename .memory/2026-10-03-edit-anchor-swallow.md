# 2026-10-03 — edit 锚点吞签名行重演（D.5 Bell）

## 情境

- D.5 P1：给 `lib/chat.ts` 追加 `sumUnread` 纯函数，锚点取了 `export function mergeFriendList(` 上方的注释结尾行。

## 问题

- `edit` 把 `mergeFriendList` 签名行整段吞掉，文件一度残留孤立参数行（`friends: ...` 无函数头）。
- 同款已在 2026-09-27 发生过（`server.ts` edit 切断注释头，CHANGELOG 有记），本次重蹈。

## 原因

- `oldString` 以注释块结尾＋函数签名首行开头时，替换后签名行丢失——锚点跨越“注释→代码”边界即高危。

## 修正

- 锚点只取最小代码行（本次应只锚 `export function mergeFriendList(` 一行，不带注释）。
- 写后即读回验证（本次 grep＋read 121–170 行即发现即修）；教训：共用层 edit 后必读回被锚函数全貌。

## round-3（2026-10-03，同一任务内又两连）
- `ChatThread` 加骨架组件时锚点取了块注释首两行，吞掉 `/**`＋首行致残留 `* ...` 悬空——修法同上（先 read 行号再下锚，写后读回 114–138 行验结构）。
- 三元包 map：开 `{loading ? (A) : (shown.map(` 后，闭合只需补一个 `)`（成 `))}`），多补 `}` 即炸。JSX 括号数不清时，改后立刻 tsc（本次即捕）。
- 结论：注释跨界锚＋括号手数是重灾区，拆成“读—小锚—读回—tsc”四步即零返工。

## round-4（2026-10-03，D.8 接线又吞一行 D.4 注释）
- 同 pattern（锚尾落在注释头），read 225–284 行即定位即补回；重复教训：凡 oldString 尾部是注释行，一律把锚延长到下一样式代码行。

## round-5（2026-10-03，E.10 openapi 吞 path 键）
- 加 path 块时 oldString 以被删行结尾，新串忘把该行写回去，致 `delete:` 悬空。修法同：增删块一律 read 回 grep 验（`toggleCheckinLike|comments/\{id\}:` 双命中才算数）。

## round-6（2026-10-03，E.10 batch5 双 lint）
- `set-state-in-effect`：组件内同步 setState 一律先想“能否 render 派生”（地点名三源优先级直接算，反查才 effect＋回调内写）；props-sync 重置走豁免注释（沿 D.7 口径）。
- `Date.now()` 做 key：换计数器 ref（同毫秒连点 key 重复是真 bug，不只 lint 面子）。

## round-7（2026-10-03，DEF-20261003-006 一字错位）
- 同文件双 hook（`t`=map／`t2`=v2）时，新 key 一律走 `t2`；加完 grep `t("checkin\|t("comment` 全验（本轮即捕零残留）。血泪：缺 key 炸整树，提交前必须浏览器开一次对应面板。

## round-8（2026-10-03，accent token 隐形字）
- `accent` 是底色 token（浅色近白），绝不能当文字色（`text-accent` 白底隐形）。要鲜艳前景一律 `text-primary`（v2scope 即 shadcn Blue，验过 `v2.module.css:25`）。Button default 即 `bg-primary`，去色运动没动它（验过 `button.tsx:11`）。

## round-9（2026-10-03，DEF-20261003-007 跟踪到底）
- Sheet 开即到底首先怀疑 Dialog 抢焦（base-ui 默认抢首个可 tab 元素），而不是滚动逻辑——本次回顶 effect 早就在，照样被 autofocus 盖过。修法只关抢焦不动 trap。

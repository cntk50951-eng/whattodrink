# 2026-10-11 — 隐身重定义：唯讀变"不暴露位置和实时动态"（iOS 输入）

## 情境

- iOS 要隐私／隐身矩阵落地：隐身不再是只读，社交通道照常，被动方不察觉。

## 问题

1. `friends_only_count` 对陌生人恒 0：过滤条件里又调了一次 `canViewCheckin`，陌生人永远 false。
2. stats（nights/places/checkins_total）数的是全部行，陌生人能从数字反推有隐藏帖。
3. `guardTitle` 文案我第一版带了 `{action}` 占位，但调用处 `t("guardTitle")` 不传参，会原样显示。
4. yaml 里 `locked` 是 required，不能直接删字段。

## 原因

1. 计数与过滤用了同一 predicate，但"另有 N 条"要的是存在性计数，不是可见性判断。
2. 旧口径主页要么全锁要么全算，没有"可见集合"概念。
3. 文案只改了值，没看调用形状。
4. 契约冻结字段只能先保留恒值。

## 修正

1. `friendsOnlyCountOf` 只数 `visibility==='friends'`（不含 private）。
2. stats／scanAll 按查看者加 `.in("visibility", visForStats)`；recent 用 `visibleRowsFor`。
3. title 改静态；判例：文案占位改动必 grep 调用处传参形状。
4. `locked` 保留恒 false＋yaml 注明；`no_visible_post` 进 envelope＋yaml。
- 未做：真机验证（等用户；iOS 配合改后联调）；migration 零（visibility 列 0007 已有）。
- 2026-10-11 晚 iOS 回复三问：locked 恒 false 同意／leave 不拦同意／保留新文案——零代码改动，只留档。

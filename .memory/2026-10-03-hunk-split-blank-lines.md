# 2026-10-03 — docs 混並行線時的 hunk 切分（DEF-002 提交）

## 情境

- 工作区混着并行线未提交改动（E.7／D.8），Bell 车提交必须只带己方 hunks。`git apply --cached` 手工拼 patch 连跪 5 次。

## 问题

1. 通用切分脚本：drop 旧边行不断 hunk → “does not apply”（旧边必须连续）。
2. 孤立 `-` 空行转 `' '`（单空格）→ git/GNU patch 皆不认，空行在 diff 里是零字节 `''`，`' '` 永远匹配不上（`grep '^$'` 验证，`grep '^ $'` 零命中）。
3. 孤立 `-` 空行即使转回 `''` 也会因“context 紧贴空删除” continued 失败（V1 实证）；但以空删除开 hunk（t3）或直接跳过它（V2）即贴。

## 原因

- `git apply` 对空行是字节较真：`''` 才是空行，`' '` 是一行一个空格的内容行。
- 旧边连续性是按**保留行**算的，drop 即断，必须拆 hunk 并重算双边计数（`+'` 丢弃不影响旧边连续，只影响新边号——但新边号必须按“保留行重放”算，不能沿用原号）。

## 修正

- 空行规则：`''` 原样保留计双边；孤立 `-` 空行若要恢复→拆 hunk 让它自成段首（t3 形），或整个跳过（V2 形，HEAD 原样保留）；孤立 `+` 空行直接 drop。
- 拆 hunk 时新边号按保留行重放：`ns = old_start + (kept_plus - kept_minus)` 累计，不是原号。
- V2Home（整 hunk 取舍）／CHANGELOG（单 hunk 行过滤）／BACKLOG（D.5 段）／DEFECTS（三手造 hunk，逐个 `--check` 再合）四档全干净合入 `8f36551`，leak scan 零并行线符号。

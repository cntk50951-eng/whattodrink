# 2026-09-04 push 凭证解法：.env 的 github_key＋inline URL

- 症状：`git push origin main` 报 `could not read Username ... Device not configured`
 （非交互会话无 credential helper）。
- 解法（符合 AGENTS.md 安全条）：`TOKEN="$(grep '^github_key=' .env | cut -d= -f2-)"`
  后 `git push "https://x-access-token:${TOKEN}@github.com/<owner>/<repo>.git" main`，
  用完 `unset TOKEN`。不打印值、不写 git config、不进 commit。
- 前提：用户先把 key 放进 `.env`（key 名 `github_key`，本次是用户现加的）。
  以后凡是 push 卡凭证，先查 `.env` 有无新增 key 名，不要反复空试。
- 本次推送：4961f88..b7aad54（UR2.4 batch1+2＋类型标注＋mobile 导出）。

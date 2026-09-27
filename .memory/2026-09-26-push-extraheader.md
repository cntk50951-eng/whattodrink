# 2026-09-26 push 工具鏈踩雷（git 2.15＋inline token）

## 情境

UR C.3 收尾推 `feat/c3-pick-sheet`，`git push https://x-access-token:${TOKEN}@github.com/...` 連報 `Error in the HTTP2 framing layer`。

## 原因

- 本機 git 只有 2.15（2017），`http.version` 配置項 2.16 才有，`-c http.version=HTTP/1.1` 被靜默忽略，照樣走 HTTP/2 握手失敗。
- 匿名 `fetch`／`ls-remote` 同時是通的，問題只出在「token 塞 URL」的推送路徑。

## 修正

- 改走 header 認證（token 不進 URL，順帶不污染 log）：
  `B64=$(printf 'x-access-token:%s' "$TOKEN" | base64)`
  `git -c http.extraHeader="Authorization: Basic ${B64}" push origin <branch>`
  一次即通。輸出再經 `sed` 把 TOKEN／B64 換 `[REDACTED]`。
- 教訓：舊 git 上 inline-token push 是已知雷，今後推送一律用 extraHeader 配方；`github-api` skill 待補這一條。

## 安全餘波

- 首次失敗那次 git 把完整 token URL 噴進了工具輸出，已在本會話可見。建議轉一圈 token（GitHub Settings → Developer settings → PATs → rotate），舊的作廢。

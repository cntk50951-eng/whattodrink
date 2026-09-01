# 2026-09-01: git 2.15 push 大 commit 失敗需加大 buffer

## 情境

Scaffold commit 含 20 張 UI 風格圖，總計 7.7 MiB。
第一次 `git push`：
```
error: RPC failed; HTTP 400 curl 56 The requested URL returned error: 400
fatal: The remote end hung up unexpectedly
```

## 問題

git 2.15.0 預設 `http.postBuffer = 1 MiB`，超過這個大小的 commit 會被拒絕。HTTP 400 是 GitHub 對過大 payload 的回應。

## 原因

老版本 git（macOS 預裝）對 HTTP/HTTPS push 的 buffer 限制是 1 MiB。
GitHub 對單個 push 的限制實際上是 100 MiB，但 git client 端會先擋。
Node.js 22 環境預裝的 git 不一定是新版。

## 修正

```bash
git config http.postBuffer 524288000   # 500 MiB，夠用
```

或一次性：
```bash
git -c http.postBuffer=524288000 push ...
```

全域設定可寫進 `~/.gitconfig` 或專案 `.git/config`。

## 學習

- 包含 binary asset（圖片、模型）的 commit 大小容易超過 git 預設
- 大 commit push 失敗時，先 `du -sh` 看 size，再決定調 buffer 或拆 commit
- 另一個選擇：用 [Git LFS](https://git-lfs.github.com/) 管理大檔，但 7 MiB 通常還不需要

## 驗證

重試後 push 成功：
```
To https://github.com/cntk50951-eng/whattodrink.git
   bc135e3..e3174ee  main -> main
```

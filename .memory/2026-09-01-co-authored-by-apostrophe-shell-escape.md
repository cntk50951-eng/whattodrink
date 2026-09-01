# 2026-09-01: Bash commit message 含 apostrophe 引發 shell escaping

## 情境

嘗試用 inline `git commit -m "$(cat <<'EOF' ... Co-Authored-By: ... EOF)"` 寫 commit message。
執行：
```
/bin/bash: eval: line 36: unexpected EOF while looking for matching `''
/bin/bash: eval: line 37: syntax error: unexpected end of file
```

## 問題

heredoc 與 shell 單引號 escape 衝突，shell 把 `Co-Authored-By: Claude Code <noreply@anthropic.com>` 裡的字面撇號當成 quoting 開頭，找不到對應關閉就 syntax error。

## 修正

把 commit message 寫到 `/tmp/whattodrink-commit-msg.txt`，然後：
```bash
git commit -F /tmp/whattodrink-commit-msg.txt
git push ...
rm /tmp/whattodrink-commit-msg.txt
```

或完全不用 heredoc，全部用 `$'...'` 或 `"..."` 並 escape 內部特殊字元。

## 學習

- 任何 commit message 含單/雙引號、`<>`、`$`、backtick 時，**先寫檔再用 `-F` 讀**
- Bash inline 寫多行 message 是反模式
- 進階：可用 `git config commit.template <file>` 設定 commit template，省去每次寫檔

## 相關

- `.harness/git.md` — commit message 格式規範

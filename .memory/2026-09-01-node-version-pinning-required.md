# 2026-09-01: Node 18 太舊、Next.js 16 要 Node 22

## 情境

原本想裝 Next.js 15（`create-next-app@15`），用 `npx --yes create-next-app@latest` 結果拉到 16.x，警告：
```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'create-next-app@16.3.4',
npm warn EBADENGINE   required: { node: '>=20.9.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }
```

## 問題

- macOS 預裝 Node 18.20.8
- Next.js 16 要求 Node 20.9+
- 工具鏈版本不一致

## 原因

Next.js 16 放棄了 Node 18 支援（先前 15.x 還支援 18.18+）。個人開發機器的 Node 版本容易過時。

## 修正

```bash
# 用 nvm 切換
source ~/.nvm/nvm.sh
nvm use 22

# 或每次指令前設 PATH（nvm use 不持久於非互動 bash session）
export PATH="/Users/yuki/.nvm/versions/node/v22.22.0/bin:$PATH"
```

已在 `README.md` 與 `.harness/architecture.md` 標明 Node 22+ 為必要條件。

## 學習

- 每個新專案第一步：確認 Node 版本是否符合依賴要求
- macOS 預裝 Node 通常很舊，`nvm use` 不持久，每個非互動 session 都要重設 PATH
- 若團隊要長期維護此專案，建議加 `.nvmrc` 寫 `22`，讓 `nvm use` 自動選對版本

## 待補

- 加 `.nvmrc` 檔
- package.json `engines` 欄位明確寫 `"node": ">=22"`

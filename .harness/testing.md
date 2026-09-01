# Testing — 測試規範

## 何時必須寫 unit test

| 場景 | 必須寫 test？ | 原因 |
|---|---|---|
| 純函數（utils、registry、helper） | ✅ 必寫 | 最容易測、ROI 最高 |
| 重要邏輯分支（推薦、決策引擎） | ✅ 必寫 | 業務核心 |
| State store action | ✅ 必寫 | 行為可預期 |
| Theme registry / tokens | ✅ 必寫 | 設定型，錯誤會影響所有頁面 |
| React component 邏輯 | ⚠️ 視情況 | 純視覺由手動 / E2E 覆蓋；含邏輯才測 |
| Next.js page | ❌ 不寫 unit | 用 E2E 覆蓋（playwright 之後裝） |
| Config 檔（tsconfig、tailwind） | ❌ | build / lint 已覆蓋 |

## 工具

- **Vitest**（之後裝）— unit + integration
- **React Testing Library**（之後裝）— component 邏輯測試
- **Playwright**（之後裝）— E2E

## Commit gate

任何 commit **含新邏輯**時，必須：
1. 寫對應 unit test
2. `npm test` 全綠
3. `npm run build` 全綠
4. `npm run lint` 無 error

## 例外（需要在 commit message 註明）

- `[skip-tests]` — 純 scaffold / config-only commit
- `[docs-only]` — 純文檔變更
- `[lockfile-only]` — 只動 `package-lock.json`

## 測試命名

- 檔案：`*.test.ts` / `*.test.tsx`（Vitest 預設）
- describe block 用被測對象名稱
- it block 用「應該...」中文或英文皆可，描述行為

範例：
```ts
describe("getTheme", () => {
  it("returns the matching theme for a valid id", () => {
    expect(getTheme("neo-brutalism").id).toBe("neo-brutalism");
  });
  it("falls back to the default theme for an unknown id", () => {
    expect(getTheme("nonexistent").id).toBe(themes[0].id);
  });
  it("falls back to the default theme for null/undefined", () => {
    expect(getTheme(null).id).toBe(themes[0].id);
  });
});
```

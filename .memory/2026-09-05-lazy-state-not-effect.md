# 2026-09-05 — lint 鐵律：localStorage 讀寫唔可以用 useEffect + setState

## 事實
- `npm run lint` 新增 `react-hooks/set-state-in-effect`（error 級）：
  `useEffect` 入面同步 `setState`（hydrate localStorage 常見寫法）直接炸。
  連累 MapFab（新）+ theme-provider（舊，已存在，一併修）。
- 正確寫法：lazy `useState` initializer 入面 try/catch 讀 localStorage。
  SSR 無 window → ReferenceError → catch 回 default；首 paint 即啱，
  無 flash、無 cascading render。theme-provider 仲順手刪咗過時 NOTE。
- 另外：本機沙盒跑 `npm run build` 必爆 Turbopack EPERM
  （worker spawn 要 bind port，`Operation not permitted`），係環境限制，
  同 CSS/代碼無關。CSS 用 postcss.parse 單獨驗過 OK（38 rules）。
  build 驗證交畀 Vercel deploy。

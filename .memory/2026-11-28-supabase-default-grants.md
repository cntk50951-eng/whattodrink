# 2026-11-28 Supabase 默認授權：函數和視圖要連 anon／authenticated 一起收（DEF-20261128-010／011）

- 模組／關鍵詞：`REVOKE ... FROM PUBLIC`、`SECURITY DEFINER`、視圖、`security_invoker`。
- 新函數與視圖默認直接授權給 `anon`、`authenticated`；只 `REVOKE FROM PUBLIC` 無效。
- 每個新函數：`REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated`，再按需 GRANT。每個新視圖：`security_invoker=true` 或收回授權。
- 行級策略不限欄位：本人可改的行，所有欄位都可改。受控欄位要放別的表或用觸發器擋。
- 上線後用 `has_function_privilege`／`has_table_privilege` 查正式庫，不要只看遷移檔。
- `users` 只走服務端身分（`lib/api/usersAccess.test.ts` 守著）。0100 之後、0101 之前匿名只有欄位授權：遊客路徑要用新欄位得另外 GRANT；新增服務端欄位要加進觸發器清單。
- 0100 起 `authenticated` 也是欄位授權（不含 live_lat／live_lng）：0101 之前新增欄位若由用戶身分讀取要另外 GRANT。收權限前按 `origin/main` 核對，不是按工作樹。
- 事故（0100）：收權限的遷移要在同一事務內斷言結果（正向授權為 true），不通過就整段回滾；執行後立刻用匿名請求打正式站。測試只吞「觸發器自己的訊息」，寬泛捕獲 `insufficient_privilege` 會把缺授權當成通過。
- 決定放不放行的讀取（隱身、年齡、停權、名額、次數、可見性）出錯必須拒絕（`requireUserRead`）；要容忍「欄位未建」得明寫 42703。改成出錯即拒絕後，部署前要確認正式庫欄位齊全。

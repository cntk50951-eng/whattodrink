-- 第七輪審核 §3.4：Ivy「忘記我」刪除世代（0085）。
-- 問題：DELETE 直接刪列，之後新列從 rev=1 重新開始；另一台設備若本地也停在 rev=1（忘記前同步過一次），
--   它帶 base_rev=1 的舊寫入會被當成「最新、非落後」直接覆蓋，剛忘記的內容就被舊設備寫回。
-- 解法：忘記＝保留一行墓碑，rev 只增不減。
--   deleted_at：墓碑標記（有值＝目前沒有記憶）；
--   forgot_rev：最近一次忘記時的 rev。base_rev 落在 (0, forgot_rev] 內的 PUT 都是忘記之前的寫入，一律 409 stale_version。
--   忘記後客戶端帶 base_rev=0 重新累積：復活墓碑，rev 接著 forgot_rev 往上走（不回到 1）。
-- 可重放；沒跑本遷移時 route 退回舊行為（直接刪列、不分世代），不阻斷上線。
ALTER TABLE bar_memories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE bar_memories ADD COLUMN IF NOT EXISTS forgot_rev integer NOT NULL DEFAULT 0;

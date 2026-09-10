-- UR A.3 / 第一個 API：beers 公開讀（A.2-2 的第一條 policy，其餘表繼續全拒）。
-- Dashboard SQL Editor 貼上執行；CLI 時代改走 migrations 順序執行。

CREATE POLICY "beers public read"
  ON beers FOR SELECT
  USING (true);

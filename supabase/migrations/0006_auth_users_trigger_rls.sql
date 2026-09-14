-- UR A.7 / Google 登入：新用户自動建行＋owner 檔 RLS。
-- Dashboard SQL Editor 貼上執行（可重放：trigger／function 用 OR REPLACE＋DROP IF EXISTS）。
-- 1. trigger：auth.users 新建→public.users 建行（SECURITY DEFINER 繞 RLS；
--    nickname 取 Google 名→email 前綴→「酒友」兜底；avatar_url 取 Google 頭像）。
-- 2. owner 檔（匿名公開讀沿 0005 不動，多 policy 是 OR 關係）：
--    users 自讀寫；checkins owner 全權（user_id NULL 的匿名舊行照樣誰都看不見）。

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, nickname, avatar_url, gender)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      '酒友'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    'secret'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "users self read" ON users;
CREATE POLICY "users self read"
  ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users self update" ON users;
CREATE POLICY "users self update"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "checkins owner read" ON checkins;
CREATE POLICY "checkins owner read"
  ON checkins FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkins owner insert" ON checkins;
CREATE POLICY "checkins owner insert"
  ON checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkins owner update" ON checkins;
CREATE POLICY "checkins owner update"
  ON checkins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkins owner delete" ON checkins;
CREATE POLICY "checkins owner delete"
  ON checkins FOR DELETE
  USING (auth.uid() = user_id);

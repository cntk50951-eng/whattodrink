-- 个人资料新栏（WEB_HANDOFF_PROFILE_FIELDS，iOS 遇见铺路）：全部选填，存量全 null。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：height_cm（140–220 由路由验，库里不加 CHECK，免存量迁移失败）；
--   occupation 枚举由路由验；languages／interests 数组（默认 {}）＋GIN 索引供以后筛选；
--   info_visibility jsonb（默认 {}；缺键＝friends，由路由判）；
--   height_cm／occupation 普通索引。RLS 无需动（/me 读写沿 0006 users self 策略）。

ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS info_visibility jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS users_languages_gin ON users USING gin (languages);
CREATE INDEX IF NOT EXISTS users_interests_gin ON users USING gin (interests);
CREATE INDEX IF NOT EXISTS users_height_idx ON users (height_cm);
CREATE INDEX IF NOT EXISTS users_occupation_idx ON users (occupation);

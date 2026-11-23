-- 0080: 系統消息與版本更新公告表（/innerharbour/notices 後台發佈 → GET /api/v1/system/notices 下發至 iOS／AOS）
-- 設計：
--   - 每條公告擁有不可變 UUID（id），iOS／AOS 本機記錄已關閉 id 即可確保「只顯示一次、不再彈出」。
--   - severity='force' 用於強制安全升級（客戶端忽略已關閉清單，直到升級至 max_version 以上）。
--   - max_version（可選 semver，如 '1.5.0'）：僅對當前安裝版本 < max_version 的客戶端下發，升級後自動不再收到。

create table if not exists public.system_notices (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'announcement' check (kind in ('update', 'maintenance', 'announcement')),
  severity text not null default 'normal' check (severity in ('normal', 'force')),
  platforms text[] not null default array['ios', 'android']::text[],
  max_version text,
  version_label text,
  title_zh_hant text not null,
  title_zh_hans text not null default '',
  title_en text not null default '',
  body_zh_hant text not null default '',
  body_zh_hans text not null default '',
  body_en text not null default '',
  -- 最多 3 條亮點：[{ icon, title_zh_hant, title_zh_hans, title_en, desc_zh_hant, desc_zh_hans, desc_en }]
  bullets jsonb not null default '[]'::jsonb,
  cta_label_zh_hant text,
  cta_label_zh_hans text,
  cta_label_en text,
  cta_url text,
  published boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_notices_active_idx
  on public.system_notices (published, starts_at desc);

alter table public.system_notices enable row level security;

comment on table public.system_notices is
  'App 系統消息與版本更新公告（後台 /innerharbour/notices 管理，API /api/v1/system/notices 唯讀下發）';

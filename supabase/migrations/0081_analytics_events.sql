-- 0081: 第一方產品埋點事件表（iOS／AOS／Web 批次上報 → /innerharbour/analytics 儀表板；未來可由後端零改包雙寫至 PostHog）
-- 設計原則：
--   - 純第一方產品分析：只存 anon_id（App 本機隨機 UUID，非 IDFA）與已登入 user_id（刪號自動置空），絕不存密碼／Token／私訊正文／精確 GPS。
--   - event_id 主鍵冪等去重（客戶端弱網重試不重複計數）。
--   - flow_id 串聯同一趟多步驟旅程（如「發佈酒局」、「登入」、「發佈打卡」），精準定位漏斗瓶頸與放棄步驟。

create table if not exists public.analytics_events (
  event_id uuid primary key,
  event_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  anon_id text not null,
  session_id text not null,
  flow_id text,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_version text,
  locale text,
  theme text,
  props jsonb not null default '{}'::jsonb,
  client_ts timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_platform_created_idx
  on public.analytics_events (platform, created_at desc);

create index if not exists analytics_events_flow_idx
  on public.analytics_events (flow_id)
  where flow_id is not null;

alter table public.analytics_events enable row level security;

comment on table public.analytics_events is
  '第一方產品埋點明細表（POST /api/v1/telemetry/events 批次寫入，/innerharbour/analytics 聚合報表；建議定期清理 >90 天明細）';

import Link from "next/link";

import { OpsNav } from "@/components/innerharbour/OpsNav";
import {
  computeAnalyticsReport,
  computeUserJourneys,
  type BreakdownItem,
  type JourneyFunnelReport,
  type JourneyKind,
  type JourneyStatus,
  type StoredAnalyticsRow,
} from "@/lib/api/telemetry";
import { requireAdminPage } from "@/lib/opsPage";

/* eslint-disable react-hooks/purity -- Server Component 實時報表需以當前時間計算 DAU/WAU/MAU 與用戶年齡。 */

export const metadata = { robots: { index: false, follow: false } };

const DAY_OPTIONS = [7, 14, 30] as const;
const PLATFORM_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "全平台" },
  { key: "ios", label: "iOS" },
  { key: "android", label: "Android" },
  { key: "web", label: "Web" },
];

const JOURNEY_OPTIONS: { key: JourneyKind | "all"; label: string }[] = [
  { key: "all", label: "全部 Journey" },
  { key: "party_create", label: "發佈酒局" },
  { key: "checkin", label: "拍照打卡" },
  { key: "auth", label: "登入註冊" },
];

const SCREEN_LABELS: Record<string, string> = {
  map_home: "首頁地圖",
  friends: "好友列表",
  party_board: "酒局廣場",
  bar_room: "3D 酒吧（Ivy）",
  nearby_bars: "附近酒吧",
  profile: "個人主頁",
  chat_room: "聊天室",
  camera: "拍照／選圖",
  party_create: "發起酒局",
};

const STEP_LABELS: Record<string, string> = {
  open: "進入頁面未操作",
  step1: "第 1 步（選酒吧）",
  step2: "第 2 步（時間／席位／細節）",
  submit: "點擊提交後未完成",
  camera: "相機／選圖階段",
  edit: "編輯照片／文字階段",
  publish: "發佈預覽頁",
  google: "Google 登入中",
  email: "電郵驗證碼登入中",
  success: "已完成",
  unknown: "未標記步驟",
};

const JOURNEY_STEP_TOKEN_LABELS: Record<string, string> = {
  party_open: "進入發局",
  party_step1: "第1步選吧",
  party_step2: "第2步細節",
  party_submit: "點發佈",
  party_success: "成功",
  party_failed: "失敗",
  party_abandon: "放棄退出",
  checkin_open: "開相機",
  checkin_photo: "已拍/選圖",
  checkin_publish_open: "進預覽頁",
  checkin_submit: "點發佈",
  checkin_success: "成功",
  checkin_failed: "失敗",
  checkin_abandon: "放棄退出",
  auth_open: "開登入頁",
  auth_submit: "提交登入",
  "auth_submit:google": "Google提交",
  "auth_submit:email": "Email提交",
  auth_success: "成功",
  auth_failed: "失敗",
  auth_abandon: "關閉退出",
};

const JOURNEY_TITLES: Record<JourneyKind, string> = {
  party_create: "發佈酒局",
  checkin: "拍照打卡",
  auth: "登入註冊",
};

type PublicUserRow = {
  id: string;
  nickname: string | null;
  gender: string | null;
  mode: string | null;
  dob: string | null;
  bio: string | null;
  occupation: string | null;
  onboarded_at: string | null;
  created_at: string;
};

type MergedUser = {
  id: string;
  email: string | null;
  provider: string;
  nickname: string | null;
  gender: string | null;
  age: number | null;
  mode: string | null;
  bio: string | null;
  occupation: string | null;
  onboarded: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

function calcAge(dob: string | null | undefined, nowMs: number): number | null {
  if (!dob) return null;
  const parsed = Date.parse(dob);
  if (!Number.isFinite(parsed)) return null;
  const age = Math.floor((nowMs - parsed) / (365.25 * 86_400_000));
  return age > 0 && age < 120 ? age : null;
}

function formatHkTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const hk = new Date(ms + 8 * 3600_000);
  return hk.toISOString().slice(5, 16).replace("T", " ");
}

function labelStep(key: string): string {
  return STEP_LABELS[key] ?? key;
}

function labelStepToken(tok: string): string {
  return JOURNEY_STEP_TOKEN_LABELS[tok] ?? tok;
}

function labelScreen(key: string): string {
  return SCREEN_LABELS[key] ?? key;
}

function formatGenderBadge(g: string | null): { text: string; bg: string; fg: string } | null {
  if (g === "male") return { text: "♂ 男", bg: "#dbeafe", fg: "#1d4ed8" };
  if (g === "female") return { text: "♀ 女", bg: "#fce7f3", fg: "#be185d" };
  return null;
}

function formatMode(mode: string | null): string {
  if (mode === "public") return "公開";
  if (mode === "friends") return "僅好友";
  if (mode === "stealth") return "隱身";
  return "—";
}

function statusBadgeStyle(status: JourneyStatus, lastStep: string, errorCode: string | null) {
  switch (status) {
    case "success":
      return { text: "成功", bg: "#d1fae5", fg: "#065f46" };
    case "failed":
      return { text: `失敗 (${errorCode ?? "unknown"})`, bg: "#fee2e2", fg: "#991b1b" };
    case "abandoned":
      return { text: `放棄 · 停在${labelStep(lastStep)}`, bg: "#fef3c7", fg: "#92400e" };
    default:
      return { text: `進行中 · ${labelStep(lastStep)}`, bg: "#e0e7ff", fg: "#3730a3" };
  }
}

function FunnelCard({ funnel }: { funnel: JourneyFunnelReport }) {
  const first = funnel.steps[0]?.count ?? 0;
  const last = funnel.steps[funnel.steps.length - 1]?.count ?? 0;
  const totalRate = first > 0 ? Math.round((last / first) * 1000) / 10 : 0;

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111" }}>{funnel.title}</h3>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            總完成率 <strong style={{ color: totalRate >= 40 ? "#065f46" : "#b45309" }}>{totalRate}%</strong>
            {funnel.avgDurationSec !== null ? ` · 平均耗時 ${funnel.avgDurationSec} 秒` : ""}
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 999,
            background: "#f3f4f6",
            color: "#374151",
            whiteSpace: "nowrap",
          }}
        >
          {first} 次進入 → {last} 次成功
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {funnel.steps.map((s, idx) => {
          const widthPct = first > 0 ? Math.max(4, Math.min(100, (s.count / first) * 100)) : 0;
          return (
            <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "#1f2937" }}>
                  {idx + 1}. {s.label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, color: "#111" }}>{s.count}</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    ({s.pctOfFirst}%{idx > 0 ? ` · 步間 ${s.pctOfPrev}%` : ""})
                  </span>
                  {idx > 0 && s.dropOff > 0 && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "1px 7px",
                        borderRadius: 999,
                        background: "#fee2e2",
                        color: "#991b1b",
                      }}
                    >
                      流失 -{s.dropOff}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${s.count > 0 ? widthPct : 0}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: idx === funnel.steps.length - 1 ? "#10b981" : "#f59e0b",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          paddingTop: 10,
          borderTop: "1px dashed #e5e7eb",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>
            最常放棄停留步驟（Bottleneck）
          </div>
          {funnel.abandonSteps.length === 0 ? (
            <div style={{ fontSize: 12, color: "#9ca3af" }}>暫無放棄記錄</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {funnel.abandonSteps.map((a) => (
                <div key={a.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: "#374151" }}>{labelStep(a.label)}</span>
                  <span style={{ fontWeight: 600, color: "#b45309" }}>
                    {a.count} ({a.pct}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>失敗錯誤碼排行</div>
          {funnel.topErrors.length === 0 ? (
            <div style={{ fontSize: 12, color: "#9ca3af" }}>暫無失敗記錄</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {funnel.topErrors.map((e) => (
                <div key={e.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <code style={{ color: "#991b1b", fontSize: 12 }}>{e.label}</code>
                  <span style={{ fontWeight: 600, color: "#991b1b" }}>
                    {e.count} ({e.pct}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BreakdownCard({
  title,
  items,
  formatLabel,
}: {
  title: string;
  items: BreakdownItem[];
  formatLabel?: (v: string) => string;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
      <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 700, color: "#111" }}>{title}</h4>
      {items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "#9ca3af" }}>暫無數據</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => (
            <div key={it.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "#374151" }}>{formatLabel ? formatLabel(it.label) : it.label}</span>
                <span style={{ fontWeight: 600, color: "#111" }}>
                  {it.count} <span style={{ color: "#6b7280", fontWeight: 400 }}>({it.pct}%)</span>
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, it.pct)}%`, height: "100%", background: "#3b82f6" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function AnalyticsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role, svc } = await requireAdminPage({}, "/innerharbour/analytics");
  const sp = await searchParams;
  const rawDays = Number(typeof sp.days === "string" ? sp.days : "14");
  const days = DAY_OPTIONS.includes(rawDays as (typeof DAY_OPTIONS)[number]) ? rawDays : 14;
  const rawPlatform = typeof sp.platform === "string" ? sp.platform : "all";
  const platform = PLATFORM_OPTIONS.some((p) => p.key === rawPlatform) ? rawPlatform : "all";
  const rawJourney = typeof sp.journey === "string" ? sp.journey : "all";
  const journeyFilter: JourneyKind | "all" = JOURNEY_OPTIONS.some((j) => j.key === rawJourney)
    ? (rawJourney as JourneyKind | "all")
    : "all";
  const userFilter = typeof sp.user === "string" && sp.user.trim() ? sp.user.trim() : null;

  const nowMs = Date.now();
  const queryWindowDays = Math.max(days, 30);
  const sinceIso = new Date(nowMs - queryWindowDays * 86_400_000).toISOString();
  const windowCutoffMs = nowMs - days * 86_400_000;

  // 併發讀取：埋點事件、public.users 資料、auth.users（含 Email 與註冊／最後登入時間）
  const [eventsRes, usersRes, authUsersRes] = await Promise.all([
    svc
      .from("analytics_events")
      .select("event_name,user_id,anon_id,session_id,flow_id,platform,app_version,locale,theme,props,created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20000),
    svc
      .from("users")
      .select("id,nickname,gender,mode,dob,bio,occupation,onboarded_at,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(500),
    svc.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const missingTable = eventsRes.error?.code === "42P01";
  const allEventRows: StoredAnalyticsRow[] =
    missingTable || !Array.isArray(eventsRes.data) ? [] : (eventsRes.data as StoredAnalyticsRow[]);

  // 若篩選單一用戶，漏斗與趨勢同步切換為該用戶視角；總註冊人數與全站用戶表保持完整
  const scopedEventRows = userFilter
    ? allEventRows.filter(
        (r) => r.user_id === userFilter || `a:${r.anon_id}` === userFilter || `u:${r.user_id}` === userFilter,
      )
    : allEventRows;

  const report = computeAnalyticsReport(scopedEventRows, { days, platform, nowMs });
  const journeys = computeUserJourneys(allEventRows, {
    days,
    platform,
    journey: journeyFilter,
    userId: userFilter,
    nowMs,
    limit: 100,
  });

  // 合併 auth.users + public.users，提供完整郵箱與個人資料
  const publicUserMap = new Map<string, PublicUserRow>();
  if (Array.isArray(usersRes.data)) {
    for (const u of usersRes.data as PublicUserRow[]) {
      publicUserMap.set(u.id, u);
    }
  }

  const authUsers = authUsersRes.data?.users ?? [];
  const mergedUsersMap = new Map<string, MergedUser>();

  for (const au of authUsers) {
    const pu = publicUserMap.get(au.id);
    const provider =
      typeof au.app_metadata?.provider === "string"
        ? au.app_metadata.provider
        : Array.isArray(au.app_metadata?.providers) && typeof au.app_metadata.providers[0] === "string"
          ? au.app_metadata.providers[0]
          : "email";
    const metaName =
      typeof au.user_metadata?.full_name === "string"
        ? au.user_metadata.full_name
        : typeof au.user_metadata?.name === "string"
          ? au.user_metadata.name
          : null;
    mergedUsersMap.set(au.id, {
      id: au.id,
      email: au.email ?? null,
      provider,
      nickname: pu?.nickname ?? metaName,
      gender: pu?.gender ?? null,
      age: calcAge(pu?.dob, nowMs),
      mode: pu?.mode ?? null,
      bio: pu?.bio ?? null,
      occupation: pu?.occupation ?? null,
      onboarded: Boolean(pu?.onboarded_at),
      createdAt: au.created_at ?? pu?.created_at ?? new Date(0).toISOString(),
      lastSignInAt: au.last_sign_in_at ?? null,
    });
  }

  for (const [id, pu] of publicUserMap.entries()) {
    if (!mergedUsersMap.has(id)) {
      mergedUsersMap.set(id, {
        id,
        email: null,
        provider: "unknown",
        nickname: pu.nickname,
        gender: pu.gender,
        age: calcAge(pu.dob, nowMs),
        mode: pu.mode,
        bio: pu.bio,
        occupation: pu.occupation,
        onboarded: Boolean(pu.onboarded_at),
        createdAt: pu.created_at,
        lastSignInAt: null,
      });
    }
  }

  const allMergedUsers = [...mergedUsersMap.values()].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const totalRegisteredUsers = Math.max(usersRes.count ?? 0, authUsers.length, allMergedUsers.length);
  const newUsersInWindow = allMergedUsers.filter((u) => Date.parse(u.createdAt) >= windowCutoffMs);
  const displayUsers = newUsersInWindow.length > 0 ? newUsersInWindow.slice(0, 60) : allMergedUsers.slice(0, 30);

  // 統計每位註冊用戶在期內的活躍事件數
  const eventCountByUser = new Map<string, number>();
  for (const r of allEventRows) {
    if (r.user_id && Date.parse(r.created_at) >= windowCutoffMs) {
      eventCountByUser.set(r.user_id, (eventCountByUser.get(r.user_id) ?? 0) + 1);
    }
  }

  const posthogEnabled = Boolean(process.env.POSTHOG_API_KEY?.trim());
  const maxDailyUsers = Math.max(1, ...report.daily.map((d) => d.activeUsers));

  const buildHref = (opts: {
    days?: number;
    platform?: string;
    journey?: JourneyKind | "all";
    user?: string | null;
  }) => {
    const q = new URLSearchParams();
    q.set("days", String(opts.days ?? days));
    q.set("platform", opts.platform ?? platform);
    const j = opts.journey ?? journeyFilter;
    if (j !== "all") q.set("journey", j);
    const u = opts.user === undefined ? userFilter : opts.user;
    if (u) q.set("user", u);
    return `/innerharbour/analytics?${q.toString()}`;
  };

  const selectedUserInfo = userFilter ? mergedUsersMap.get(userFilter) ?? null : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <OpsNav active="analytics" role={role} />

      <main style={{ maxWidth: 1220, margin: "0 auto", padding: "24px 20px 64px" }}>
        {/* 頂部標題 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111" }}>產品埋點、用戶與漏斗報表</h1>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              全站註冊人數、活躍人數、新增用戶資料與逐人 Journey 流失診斷（香港時間 UTC+8）
            </div>
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: 999,
              background: posthogEnabled ? "#d1fae5" : "#eef2ff",
              color: posthogEnabled ? "#065f46" : "#3730a3",
            }}
          >
            {posthogEnabled ? "PostHog 雙寫：已開啟" : "PostHog 雙寫：未啟用（Supabase 自建模式）"}
          </span>
        </div>

        {/* 篩選條 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
            padding: "10px 14px",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#6b7280", marginRight: 4 }}>時間範圍：</span>
            {DAY_OPTIONS.map((d) => {
              const on = d === days;
              return (
                <Link
                  key={d}
                  href={buildHref({ days: d })}
                  style={{
                    textDecoration: "none",
                    fontSize: 12.5,
                    fontWeight: on ? 700 : 500,
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: on ? "#111" : "#f3f4f6",
                    color: on ? "#fff" : "#374151",
                  }}
                >
                  近 {d} 天
                </Link>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#6b7280", marginRight: 4 }}>平台：</span>
            {PLATFORM_OPTIONS.map((p) => {
              const on = p.key === platform;
              return (
                <Link
                  key={p.key}
                  href={buildHref({ platform: p.key })}
                  style={{
                    textDecoration: "none",
                    fontSize: 12.5,
                    fontWeight: on ? 700 : 500,
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: on ? "#f59e0b" : "#f3f4f6",
                    color: on ? "#111" : "#374151",
                  }}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* 單一用戶聚焦橫幅 */}
        {userFilter && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 12,
              background: "#eff6ff",
              border: "1px solid #93c5fd",
              marginBottom: 18,
              fontSize: 13.5,
            }}
          >
            <div>
              正在檢視單一用戶軌跡：
              <strong style={{ color: "#1e3a8a", marginLeft: 4 }}>
                {selectedUserInfo?.nickname || selectedUserInfo?.email || userFilter}
              </strong>
              {selectedUserInfo?.email && (
                <span style={{ color: "#3b82f6", marginLeft: 8 }}>{selectedUserInfo.email}</span>
              )}
            </div>
            <Link
              href={buildHref({ user: null })}
              style={{
                textDecoration: "none",
                fontSize: 12.5,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 999,
                background: "#1d4ed8",
                color: "#fff",
              }}
            >
              ✕ 返回全部用戶
            </Link>
          </div>
        )}

        {missingTable && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "#fef3c7",
              border: "1px solid #f59e0b",
              color: "#92400e",
              fontSize: 13.5,
              marginBottom: 20,
            }}
          >
            尚未建立 <code>analytics_events</code> 資料表。請先於 Supabase SQL Editor 執行{" "}
            <code>supabase/migrations/0081_analytics_events.sql</code>。
          </div>
        )}

        {/* 第一排：核心大盤總數（已註冊用戶總數 & 活躍用戶總數最醒目） */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
              color: "#fff",
              borderRadius: 14,
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#d1d5db" }}>已註冊用戶總數（全站）</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 800 }}>{totalRegisteredUsers}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(16, 185, 129, 0.22)",
                  color: "#6ee7b7",
                }}
              >
                近 {days} 天新增 +{newUsersInWindow.length}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 6 }}>
              來自 Supabase Auth / users 表即時總計
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)",
              color: "#111",
              borderRadius: 14,
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#451a03" }}>活躍用戶總數（近 {days} 天不重複）</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#111" }}>{report.activeUsersInWindow}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.65)",
                  color: "#78350f",
                }}
              >
                今日 DAU {report.dauToday}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "#451a03", marginTop: 6 }}>
              7 日 WAU {report.wau7d} · 30 日 MAU {report.mau30d} · 日均 {report.avgDau}
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#6b7280" }}>期內會話與事件（近 {days} 天）</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#111", marginTop: 6 }}>{report.totalSessions}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              共 {report.totalEvents} 條事件 · 登入成功 {report.loginSuccessCount} 次
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#6b7280" }}>核心產出（發局 / 打卡成功）</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#111", marginTop: 6 }}>
              {report.partySuccessCount} / {report.checkinSuccessCount}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>近 {days} 天完成發佈酒局 / 拍照打卡數</div>
          </div>
        </div>

        {/* 新增／近期註冊用戶明細表（郵箱＋資料＋一鍵追此人軌跡） */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 18,
            marginBottom: 22,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111" }}>
                {newUsersInWindow.length > 0
                  ? `近 ${days} 天新增註冊用戶（共 ${newUsersInWindow.length} 人）`
                  : `近期註冊用戶（近 ${days} 天無新增，顯示最新 ${displayUsers.length} 人）`}
              </h2>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                包含郵箱、登入方式、性別年齡、隱私模式、是否完成引導，點擊「看軌跡」可過濾該用戶所有 Journey
              </div>
            </div>
          </div>

          {displayUsers.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0" }}>暫無用戶資料</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#6b7280" }}>
                    <th style={{ padding: "8px 8px" }}>暱稱 / 郵箱</th>
                    <th style={{ padding: "8px 8px" }}>登入方式</th>
                    <th style={{ padding: "8px 8px" }}>資料（性別／年齡／模式）</th>
                    <th style={{ padding: "8px 8px" }}>職業 / 簡介</th>
                    <th style={{ padding: "8px 8px" }}>引導</th>
                    <th style={{ padding: "8px 8px" }}>期內事件</th>
                    <th style={{ padding: "8px 8px" }}>註冊時間 / 最後登入</th>
                    <th style={{ padding: "8px 8px" }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayUsers.map((u) => {
                    const gb = formatGenderBadge(u.gender);
                    const evCount = eventCountByUser.get(u.id) ?? 0;
                    const activeRow = userFilter === u.id;
                    return (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          background: activeRow ? "#eff6ff" : "transparent",
                        }}
                      >
                        <td style={{ padding: "9px 8px" }}>
                          <div style={{ fontWeight: 700, color: "#111" }}>{u.nickname || "（未設暱稱）"}</div>
                          <div style={{ fontSize: 11.5, color: "#4b5563" }}>{u.email || u.id.slice(0, 8)}</div>
                        </td>
                        <td style={{ padding: "9px 8px" }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: u.provider === "google" ? "#fef3c7" : "#f3f4f6",
                              color: u.provider === "google" ? "#92400e" : "#374151",
                            }}
                          >
                            {u.provider}
                          </span>
                        </td>
                        <td style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {gb ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 999,
                                  background: gb.bg,
                                  color: gb.fg,
                                }}
                              >
                                {gb.text}
                              </span>
                            ) : (
                              <span style={{ color: "#9ca3af" }}>未填</span>
                            )}
                            {u.age !== null && <span style={{ fontWeight: 600, color: "#111" }}>{u.age}歲</span>}
                            <span style={{ fontSize: 11.5, color: "#6b7280" }}>· {formatMode(u.mode)}</span>
                          </div>
                        </td>
                        <td style={{ padding: "9px 8px", maxWidth: 220, color: "#4b5563" }}>
                          {[u.occupation, u.bio].filter(Boolean).join(" · ").slice(0, 50) || "—"}
                        </td>
                        <td style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: u.onboarded ? "#065f46" : "#b45309",
                            }}
                          >
                            {u.onboarded ? "✓ 已完成" : "未完成"}
                          </span>
                        </td>
                        <td style={{ padding: "9px 8px", fontWeight: 600 }}>{evCount}</td>
                        <td style={{ padding: "9px 8px", whiteSpace: "nowrap", fontSize: 11.5, color: "#6b7280" }}>
                          <div>註冊：{formatHkTime(u.createdAt)}</div>
                          <div>登入：{formatHkTime(u.lastSignInAt)}</div>
                        </td>
                        <td style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>
                          <Link
                            href={buildHref({ user: activeRow ? null : u.id })}
                            style={{
                              textDecoration: "none",
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "4px 10px",
                              borderRadius: 8,
                              background: activeRow ? "#1d4ed8" : "#f3f4f6",
                              color: activeRow ? "#fff" : "#111",
                            }}
                          >
                            {activeRow ? "檢視中" : "看軌跡 →"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* By User Journey 漏斗軌跡明細表 */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 18,
            marginBottom: 22,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111" }}>
                按用戶檢視 Journey 執行明細（By User · 最新 {journeys.length} 筆）
              </h2>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                精確查看每位用戶在「發佈酒局／拍照打卡／登入」走到哪一步、是否成功或停在哪裡放棄
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {JOURNEY_OPTIONS.map((j) => {
                const on = j.key === journeyFilter;
                return (
                  <Link
                    key={j.key}
                    href={buildHref({ journey: j.key })}
                    style={{
                      textDecoration: "none",
                      fontSize: 12,
                      fontWeight: on ? 700 : 500,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: on ? "#111" : "#f3f4f6",
                      color: on ? "#fff" : "#374151",
                    }}
                  >
                    {j.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {journeys.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0" }}>
              此篩選條件下暫無 Journey 紀錄（在 App 操作登入、發佈酒局或拍照打卡後約 15 秒或退後台即會上報）
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#6b7280" }}>
                    <th style={{ padding: "8px 8px" }}>時間 (HKT)</th>
                    <th style={{ padding: "8px 8px" }}>用戶（暱稱／郵箱）</th>
                    <th style={{ padding: "8px 8px" }}>Journey</th>
                    <th style={{ padding: "8px 8px" }}>結果與瓶頸</th>
                    <th style={{ padding: "8px 8px" }}>步驟路徑</th>
                    <th style={{ padding: "8px 8px" }}>耗時</th>
                    <th style={{ padding: "8px 8px" }}>平台 / 版本</th>
                  </tr>
                </thead>
                <tbody>
                  {journeys.map((j) => {
                    const u = j.userId ? mergedUsersMap.get(j.userId) : null;
                    const badge = statusBadgeStyle(j.status, j.lastStep, j.errorCode);
                    const targetFilter = j.userId ?? `a:${j.anonId}`;
                    return (
                      <tr key={`${j.journey}-${j.flowId}-${j.lastEventAt}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "9px 8px", whiteSpace: "nowrap", color: "#6b7280", fontSize: 11.5 }}>
                          {formatHkTime(j.lastEventAt)}
                        </td>
                        <td style={{ padding: "9px 8px" }}>
                          <Link
                            href={buildHref({ user: targetFilter })}
                            style={{ textDecoration: "none", color: "#111" }}
                          >
                            <div style={{ fontWeight: 700 }}>
                              {u?.nickname || (j.userId ? `用戶 ${j.userId.slice(0, 8)}` : `訪客 ${j.anonId.slice(0, 8)}`)}
                            </div>
                            <div style={{ fontSize: 11.5, color: "#6b7280" }}>
                              {u?.email || (j.userId ? j.userId.slice(0, 12) : "未登入匿名裝置")}
                            </div>
                          </Link>
                        </td>
                        <td style={{ padding: "9px 8px", whiteSpace: "nowrap", fontWeight: 600 }}>
                          {JOURNEY_TITLES[j.journey]}
                        </td>
                        <td style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: "3px 9px",
                              borderRadius: 999,
                              background: badge.bg,
                              color: badge.fg,
                            }}
                          >
                            {badge.text}
                          </span>
                        </td>
                        <td style={{ padding: "9px 8px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
                            {j.steps.map((st, idx) => (
                              <span key={`${st}-${idx}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                {idx > 0 && <span style={{ color: "#9ca3af" }}>→</span>}
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: "1px 6px",
                                    borderRadius: 6,
                                    background: "#f3f4f6",
                                    color: "#374151",
                                  }}
                                >
                                  {labelStepToken(st)}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "9px 8px", whiteSpace: "nowrap", color: "#374151" }}>
                          {j.durationSec !== null ? `${j.durationSec}s` : "—"}
                        </td>
                        <td style={{ padding: "9px 8px", whiteSpace: "nowrap", fontSize: 11.5, color: "#6b7280" }}>
                          {j.platform} {j.appVersion ?? ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 每日活躍趨勢圖 */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 18,
            marginBottom: 22,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111" }}>每日活躍用戶趨勢（近 {days} 天）</h2>
            <span style={{ fontSize: 12, color: "#6b7280" }}>柱高 = 當日不重複活躍人數（DAU）</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
              height: 140,
              padding: "8px 4px 4px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            {report.daily.map((d) => {
              const barPct = d.activeUsers > 0 ? Math.max(8, Math.round((d.activeUsers / maxDailyUsers) * 100)) : 2;
              return (
                <div
                  key={d.day}
                  title={`${d.day}：DAU ${d.activeUsers}｜會話 ${d.sessions}｜發局 ${d.partySuccess}｜打卡 ${d.checkinSuccess}｜訊息 ${d.chats}`}
                  style={{
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 4,
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: d.activeUsers > 0 ? "#111" : "#d1d5db" }}>
                    {d.activeUsers}
                  </span>
                  <div
                    style={{
                      width: "72%",
                      maxWidth: 32,
                      height: `${barPct}%`,
                      borderRadius: "6px 6px 2px 2px",
                      background: d.activeUsers > 0 ? "#f59e0b" : "#f3f4f6",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, paddingTop: 6 }}>
            {report.daily.map((d, idx) => {
              const showLabel = days <= 14 || idx % 3 === 0 || idx === report.daily.length - 1;
              return (
                <div key={d.day} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: "#6b7280", minWidth: 0 }}>
                  {showLabel ? d.day.slice(5) : ""}
                </div>
              );
            })}
          </div>

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
              展開每日明細表（會話／發局／打卡／聊天）
            </summary>
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#6b7280" }}>
                    <th style={{ padding: "6px 8px" }}>日期</th>
                    <th style={{ padding: "6px 8px" }}>活躍人數</th>
                    <th style={{ padding: "6px 8px" }}>會話數</th>
                    <th style={{ padding: "6px 8px" }}>發佈酒局</th>
                    <th style={{ padding: "6px 8px" }}>發佈打卡</th>
                    <th style={{ padding: "6px 8px" }}>聊天訊息</th>
                    <th style={{ padding: "6px 8px" }}>總事件</th>
                  </tr>
                </thead>
                <tbody>
                  {[...report.daily].reverse().map((d) => (
                    <tr key={d.day} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{d.day}</td>
                      <td style={{ padding: "6px 8px" }}>{d.activeUsers}</td>
                      <td style={{ padding: "6px 8px" }}>{d.sessions}</td>
                      <td style={{ padding: "6px 8px" }}>{d.partySuccess}</td>
                      <td style={{ padding: "6px 8px" }}>{d.checkinSuccess}</td>
                      <td style={{ padding: "6px 8px" }}>{d.chats}</td>
                      <td style={{ padding: "6px 8px", color: "#6b7280" }}>{d.events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        {/* 三大核心 Journey 漏斗總覽 */}
        <h2 style={{ margin: "0 0 12px 0", fontSize: 17, fontWeight: 800, color: "#111" }}>
          關鍵 Journey 轉化總覽（按 flow_id 去重）
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          <FunnelCard funnel={report.funnels.partyCreate} />
          <FunnelCard funnel={report.funnels.checkin} />
          <FunnelCard funnel={report.funnels.auth} />
        </div>

        {/* 環境與頁面分佈 */}
        <h2 style={{ margin: "0 0 12px 0", fontSize: 17, fontWeight: 800, color: "#111" }}>裝置環境與頁面訪問分佈</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <BreakdownCard title="熱門頁面訪問量（screen_view）" items={report.screens} formatLabel={labelScreen} />
          <BreakdownCard title="平台佔比（去重用戶）" items={report.platforms} />
          <BreakdownCard title="App 版本分佈" items={report.versions} />
          <BreakdownCard title="主題偏好（深色 / 淺色）" items={report.themes} />
          <BreakdownCard title="語言分佈（Locale）" items={report.locales} />
        </div>
      </main>
    </div>
  );
}

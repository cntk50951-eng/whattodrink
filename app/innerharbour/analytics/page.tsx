import Link from "next/link";

import { OpsNav } from "@/components/innerharbour/OpsNav";
import {
  computeAnalyticsReport,
  type BreakdownItem,
  type JourneyFunnelReport,
  type StoredAnalyticsRow,
} from "@/lib/api/telemetry";
import { requireAdminPage } from "@/lib/opsPage";

/* eslint-disable react-hooks/purity -- Server Component 實時報表需以當前時間計算 DAU/WAU/MAU 視窗。 */

export const metadata = { robots: { index: false, follow: false } };

const DAY_OPTIONS = [7, 14, 30] as const;
const PLATFORM_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "全平台" },
  { key: "ios", label: "iOS" },
  { key: "android", label: "Android" },
  { key: "web", label: "Web" },
];

const SCREEN_LABELS: Record<string, string> = {
  map_home: "首頁地圖",
  friends: "好友列表",
  party_board: "酒局廣場",
  bar_room: "酒吧互動 / 遊戲",
  profile: "個人主頁",
  chat_room: "聊天室",
  camera: "拍照／選圖",
  party_create: "發起酒局",
};

const STEP_LABELS: Record<string, string> = {
  open: "進入頁面未操作",
  step1: "第 1 步（飲咩／時間／人數）",
  step2: "第 2 步（地點與細節）",
  submit: "點擊提交後未完成",
  camera: "相機／選圖階段",
  edit: "編輯照片／文字階段",
  publish: "發佈預覽頁",
  google: "Google 登入中",
  email: "電郵驗證碼登入中",
  unknown: "未標記步驟",
};

function labelStep(key: string): string {
  return STEP_LABELS[key] ?? key;
}

function labelScreen(key: string): string {
  return SCREEN_LABELS[key] ?? key;
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

      {/* 步驟進度條 */}
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
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "#f3f4f6",
                  overflow: "hidden",
                }}
              >
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

      {/* 瓶頸診斷：最常放棄步驟 & 錯誤碼 */}
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
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>
            失敗錯誤碼排行
          </div>
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
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
      }}
    >
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

  const nowMs = Date.now();
  const queryWindowDays = Math.max(days, 30);
  const sinceIso = new Date(nowMs - queryWindowDays * 86_400_000).toISOString();

  const { data, error } = await svc
    .from("analytics_events")
    .select("event_name,user_id,anon_id,session_id,flow_id,platform,app_version,locale,theme,props,created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(20000);

  const missingTable = error?.code === "42P01";
  const rows: StoredAnalyticsRow[] = missingTable || !Array.isArray(data) ? [] : (data as StoredAnalyticsRow[]);
  const report = computeAnalyticsReport(rows, { days, platform, nowMs });

  const posthogEnabled = Boolean(process.env.POSTHOG_API_KEY?.trim());
  const maxDailyUsers = Math.max(1, ...report.daily.map((d) => d.activeUsers));

  const buildHref = (nextDays: number, nextPlatform: string) =>
    `/innerharbour/analytics?days=${nextDays}&platform=${encodeURIComponent(nextPlatform)}`;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <OpsNav active="analytics" role={role} />

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 56px" }}>
        {/* 頂部標題與篩選列 */}
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
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111" }}>產品埋點與漏斗報表</h1>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              日均活躍（DAU/WAU/MAU）與關鍵 Journey 流失診斷 · 單次最多聚合 20,000 條事件（香港時間 UTC+8）
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
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
        </div>

        {/* 篩選條件條 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
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
                  href={buildHref(d, platform)}
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
                  href={buildHref(days, p.key)}
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

        {/* 未執行 0081 migration 提示 */}
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
            <code>supabase/migrations/0081_analytics_events.sql</code>，App 上報的埋點與漏斗數據即會自動出現。
          </div>
        )}

        {error && !missingTable && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            查詢報表失敗：{error.message}
          </div>
        )}

        {/* 6 張核心 KPI 卡 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
            marginBottom: 22,
          }}
        >
          {[
            { label: "今日活躍（DAU）", value: String(report.dauToday), sub: "今日不重複用戶／裝置" },
            { label: "7 日活躍（WAU）", value: String(report.wau7d), sub: "近 7 天不重複" },
            { label: "30 日活躍（MAU）", value: String(report.mau30d), sub: "近 30 天不重複" },
            { label: `近 ${days} 天日均活躍`, value: String(report.avgDau), sub: `共 ${report.totalEvents} 條事件` },
            { label: `近 ${days} 天總會話`, value: String(report.totalSessions), sub: `登入成功 ${report.loginSuccessCount} 次` },
            {
              label: "核心產出（發局／打卡）",
              value: `${report.partySuccessCount} / ${report.checkinSuccessCount}`,
              sub: "成功發佈酒局 / 打卡數",
            },
          ].map((k) => (
            <div
              key={k.label}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#111", marginTop: 4 }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* 每日活躍趨勢圖 + 明細表 */}
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
                <div
                  key={d.day}
                  style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: "#6b7280", minWidth: 0 }}
                >
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

        {/* 三大核心 Journey 漏斗 */}
        <h2 style={{ margin: "0 0 12px 0", fontSize: 17, fontWeight: 800, color: "#111" }}>
          關鍵 Journey 轉化與瓶頸分析（按 flow_id 去重）
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          <FunnelCard funnel={report.funnels.partyCreate} />
          <FunnelCard funnel={report.funnels.auth} />
          <FunnelCard funnel={report.funnels.checkin} />
        </div>

        {/* 環境與頁面分佈 */}
        <h2 style={{ margin: "0 0 12px 0", fontSize: 17, fontWeight: 800, color: "#111" }}>
          裝置環境與頁面訪問分佈
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
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

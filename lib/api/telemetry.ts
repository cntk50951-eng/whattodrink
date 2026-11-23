// 第一方產品埋點與漏斗報表聚合（0081）：
// - 嚴格事件白名單＋PII 過濾＋單批次上限 50 條
// - 預留可選 PostHog Server-side 轉發（設定 POSTHOG_API_KEY 即自動雙寫，App 端零改動）
// - 純函數 computeAnalyticsReport 供 /innerharbour/analytics 看板與 vitest 單測共用

export type TelemetryPlatform = "ios" | "android" | "web";

export const TELEMETRY_EVENTS = new Set<string>([
  // 活躍與頁面訪問
  "app_open",
  "screen_view",
  // 登入漏斗
  "auth_open",
  "auth_submit",
  "auth_success",
  "auth_failed",
  "auth_abandon",
  "onboarding_complete",
  // 發佈酒局漏斗
  "party_create_open",
  "party_create_step_view",
  "party_create_submit",
  "party_create_success",
  "party_create_failed",
  "party_create_abandon",
  // 拍照／打卡發佈漏斗
  "checkin_open",
  "checkin_photo_ready",
  "checkin_publish_open",
  "checkin_publish_submit",
  "checkin_publish_success",
  "checkin_publish_failed",
  "checkin_abandon",
  // 核心社交動作
  "party_join_success",
  "chat_send",
  "cheers_send",
  "bar_game_start",
]);

const VALID_PLATFORMS = new Set<string>(["ios", "android", "web"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 禁止進入 props 的敏感鍵名（防誤傳個資／憑證／正文／精確座標）。 */
const BLOCKED_PROP_KEYS = new Set<string>([
  "email",
  "phone",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "body",
  "message",
  "note",
  "lat",
  "lng",
  "latitude",
  "longitude",
]);

export type ParsedTelemetryEvent = {
  event_id: string;
  event_name: string;
  anon_id: string;
  session_id: string;
  flow_id: string | null;
  platform: TelemetryPlatform;
  app_version: string | null;
  locale: string | null;
  theme: string | null;
  props: Record<string, string | number | boolean | null>;
  client_ts: string;
};

function shortStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length > 0 ? s : null;
}

function sanitizeProps(raw: unknown): Record<string, string | number | boolean | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 16) break;
    const key = k.trim().slice(0, 40);
    if (!key || BLOCKED_PROP_KEYS.has(key.toLowerCase())) continue;
    if (typeof v === "string") {
      out[key] = v.trim().slice(0, 120);
      count += 1;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = Math.round(v * 1000) / 1000;
      count += 1;
    } else if (typeof v === "boolean") {
      out[key] = v;
      count += 1;
    } else if (v === null) {
      out[key] = null;
      count += 1;
    }
  }
  return out;
}

/** 解析並校驗批次上報（1–50 條；單條非法會略過不拖垮整批）。 */
export function parseTelemetryBatch(
  body: unknown,
  nowMs: number = Date.now(),
): { ok: true; events: ParsedTelemetryEvent[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "請求體必須為 JSON 物件" };
  const rawEvents = (body as { events?: unknown }).events;
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return { ok: false, error: "events 不可為空" };
  }
  if (rawEvents.length > 50) {
    return { ok: false, error: "單次批次最多 50 條事件" };
  }
  const events: ParsedTelemetryEvent[] = [];
  for (const item of rawEvents) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const eventId = shortStr(r.event_id, 64);
    const eventName = shortStr(r.event_name, 64);
    const anonId = shortStr(r.anon_id, 64);
    const sessionId = shortStr(r.session_id, 64);
    const platformRaw = shortStr(r.platform, 16)?.toLowerCase() ?? "";
    if (!eventId || !UUID_RE.test(eventId)) continue;
    if (!eventName || !TELEMETRY_EVENTS.has(eventName)) continue;
    if (!anonId || !sessionId) continue;
    if (!VALID_PLATFORMS.has(platformRaw)) continue;

    const rawTs = typeof r.client_ts === "number" && Number.isFinite(r.client_ts) ? r.client_ts : nowMs;
    // 防客戶端時鐘嚴重漂移（箝位在 now ± 7 天內）
    const clampedTs = Math.min(Math.max(rawTs, nowMs - 7 * 86_400_000), nowMs + 86_400_000);

    events.push({
      event_id: eventId,
      event_name: eventName,
      anon_id: anonId,
      session_id: sessionId,
      flow_id: shortStr(r.flow_id, 64),
      platform: platformRaw as TelemetryPlatform,
      app_version: shortStr(r.app_version, 24),
      locale: shortStr(r.locale, 16),
      theme: shortStr(r.theme, 16),
      props: sanitizeProps(r.props),
      client_ts: new Date(clampedTs).toISOString(),
    });
  }
  return { ok: true, events };
}

/**
 * 可選 PostHog Server-side 轉發（未來切換 PostHog 只需在 Vercel 設定 POSTHOG_API_KEY，零 App 改動）：
 * 未設定 POSTHOG_API_KEY 時立即返回、零開銷。
 */
export async function forwardToPostHog(
  events: (ParsedTelemetryEvent & { user_id: string | null })[],
): Promise<void> {
  const apiKey = process.env.POSTHOG_API_KEY?.trim();
  if (!apiKey || events.length === 0) return;
  const host = (process.env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com").replace(/\/$/, "");
  const batch = events.map((e) => ({
    event: e.event_name,
    distinct_id: e.user_id ?? `anon:${e.anon_id}`,
    timestamp: e.client_ts,
    uuid: e.event_id,
    properties: {
      ...e.props,
      $session_id: e.session_id,
      flow_id: e.flow_id,
      platform: e.platform,
      app_version: e.app_version,
      locale: e.locale,
      theme: e.theme,
      anon_id: e.anon_id,
      $lib: "whattodrink-server-proxy",
    },
  }));
  try {
    await fetch(`${host}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, batch }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err) {
    console.warn(`[telemetry] posthog forward skipped: ${(err as Error).message}`);
  }
}

// ============================================================================
// Dashboard 報表聚合純函數（供 /innerharbour/analytics 頁面使用）
// ============================================================================

export type StoredAnalyticsRow = {
  event_id?: string;
  event_name: string;
  user_id: string | null;
  anon_id: string;
  session_id: string;
  flow_id: string | null;
  platform: string;
  app_version: string | null;
  locale: string | null;
  theme: string | null;
  props: Record<string, unknown> | null;
  created_at: string;
};

export type FunnelStepStat = {
  key: string;
  label: string;
  count: number;
  pctOfFirst: number;
  pctOfPrev: number;
  dropOff: number;
};

export type BreakdownItem = {
  label: string;
  count: number;
  pct: number;
};

export type JourneyFunnelReport = {
  id: string;
  title: string;
  steps: FunnelStepStat[];
  avgDurationSec: number | null;
  abandonSteps: BreakdownItem[];
  topErrors: BreakdownItem[];
};

export type DailyActivityPoint = {
  day: string; // YYYY-MM-DD (HKT)
  activeUsers: number;
  sessions: number;
  events: number;
  partySuccess: number;
  checkinSuccess: number;
  chats: number;
};

export type AnalyticsDashboardReport = {
  days: number;
  platform: string;
  totalEvents: number;
  dauToday: number;
  wau7d: number;
  mau30d: number;
  avgDau: number;
  totalSessions: number;
  loginSuccessCount: number;
  partySuccessCount: number;
  checkinSuccessCount: number;
  daily: DailyActivityPoint[];
  funnels: {
    auth: JourneyFunnelReport;
    partyCreate: JourneyFunnelReport;
    checkin: JourneyFunnelReport;
  };
  platforms: BreakdownItem[];
  versions: BreakdownItem[];
  themes: BreakdownItem[];
  locales: BreakdownItem[];
  screens: BreakdownItem[];
};

function hkDayKey(ms: number): string {
  const hk = new Date(ms + 8 * 3600_000);
  return hk.toISOString().slice(0, 10);
}

function actorKey(r: StoredAnalyticsRow): string {
  return r.user_id ? `u:${r.user_id}` : `a:${r.anon_id}`;
}

function flowKey(r: StoredAnalyticsRow): string {
  return r.flow_id && r.flow_id.trim() ? r.flow_id : `${r.session_id}:${actorKey(r)}`;
}

function toBreakdown(counts: Map<string, number>, limit = 8): BreakdownItem[] {
  let total = 0;
  for (const v of counts.values()) total += v;
  if (total === 0) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 1000) / 10,
    }));
}

function buildFunnel(
  id: string,
  title: string,
  rows: StoredAnalyticsRow[],
  stepDefs: { key: string; label: string; match: (r: StoredAnalyticsRow) => boolean }[],
  abandonEvent: string,
  failedEvent: string,
  successEvent: string,
): JourneyFunnelReport {
  const stepSets = stepDefs.map(() => new Set<string>());
  const abandonCounts = new Map<string, number>();
  const errorCounts = new Map<string, number>();
  const durations: number[] = [];

  for (const r of rows) {
    const fk = flowKey(r);
    stepDefs.forEach((def, idx) => {
      if (def.match(r)) stepSets[idx]?.add(fk);
    });
    if (r.event_name === abandonEvent) {
      const last = typeof r.props?.last_step === "string" && r.props.last_step.trim() ? r.props.last_step.trim() : "unknown";
      abandonCounts.set(last, (abandonCounts.get(last) ?? 0) + 1);
    }
    if (r.event_name === failedEvent) {
      const code = typeof r.props?.error_code === "string" && r.props.error_code.trim() ? r.props.error_code.trim() : "unknown";
      errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
    }
    if (r.event_name === successEvent) {
      const ms = typeof r.props?.duration_ms === "number" ? r.props.duration_ms : NaN;
      if (Number.isFinite(ms) && ms > 0 && ms < 3_600_000) {
        durations.push(ms);
      }
    }
  }

  const firstCount = stepSets[0]?.size ?? 0;
  const steps: FunnelStepStat[] = stepDefs.map((def, i) => {
    const count = stepSets[i]?.size ?? 0;
    const prevCount = i === 0 ? count : (stepSets[i - 1]?.size ?? 0);
    return {
      key: def.key,
      label: def.label,
      count,
      pctOfFirst: firstCount > 0 ? Math.round((count / firstCount) * 1000) / 10 : 0,
      pctOfPrev: prevCount > 0 ? Math.round((count / prevCount) * 1000) / 10 : 0,
      dropOff: i === 0 ? 0 : Math.max(0, prevCount - count),
    };
  });

  const avgDurationSec =
    durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length / 1000) * 10) / 10
      : null;

  return {
    id,
    title,
    steps,
    avgDurationSec,
    abandonSteps: toBreakdown(abandonCounts, 6),
    topErrors: toBreakdown(errorCounts, 6),
  };
}

export function computeAnalyticsReport(
  allRows: StoredAnalyticsRow[],
  opts: { days: number; platform?: string; nowMs?: number },
): AnalyticsDashboardReport {
  const nowMs = opts.nowMs ?? Date.now();
  const days = Math.min(Math.max(opts.days, 1), 90);
  const platformFilter = opts.platform && VALID_PLATFORMS.has(opts.platform) ? opts.platform : "all";

  const scopedAll = platformFilter === "all" ? allRows : allRows.filter((r) => r.platform === platformFilter);

  const todayKey = hkDayKey(nowMs);
  const cutoff7d = nowMs - 7 * 86_400_000;
  const cutoff30d = nowMs - 30 * 86_400_000;
  const cutoffWindow = nowMs - days * 86_400_000;

  const dauSet = new Set<string>();
  const wauSet = new Set<string>();
  const mauSet = new Set<string>();
  const windowRows: StoredAnalyticsRow[] = [];

  for (const r of scopedAll) {
    const ms = Date.parse(r.created_at);
    if (!Number.isFinite(ms)) continue;
    const actor = actorKey(r);
    if (hkDayKey(ms) === todayKey) dauSet.add(actor);
    if (ms >= cutoff7d) wauSet.add(actor);
    if (ms >= cutoff30d) mauSet.add(actor);
    if (ms >= cutoffWindow) windowRows.push(r);
  }

  // 初始化連續 days 天的日桶（確保無數據日期也補 0）
  const dayKeys: string[] = [];
  const dayBuckets = new Map<
    string,
    { users: Set<string>; sessions: Set<string>; events: number; parties: number; checkins: number; chats: number }
  >();
  for (let i = days - 1; i >= 0; i -= 1) {
    const k = hkDayKey(nowMs - i * 86_400_000);
    dayKeys.push(k);
    dayBuckets.set(k, { users: new Set(), sessions: new Set(), events: 0, parties: 0, checkins: 0, chats: 0 });
  }

  const allSessions = new Set<string>();
  const actorPlatform = new Map<string, string>();
  const actorVersion = new Map<string, string>();
  const actorTheme = new Map<string, string>();
  const actorLocale = new Map<string, string>();
  const screenCounts = new Map<string, number>();

  let loginSuccessCount = 0;
  let partySuccessCount = 0;
  let checkinSuccessCount = 0;

  for (const r of windowRows) {
    const ms = Date.parse(r.created_at);
    const dk = hkDayKey(ms);
    const actor = actorKey(r);
    allSessions.add(r.session_id);

    const b = dayBuckets.get(dk);
    if (b) {
      b.users.add(actor);
      b.sessions.add(r.session_id);
      b.events += 1;
      if (r.event_name === "party_create_success") b.parties += 1;
      if (r.event_name === "checkin_publish_success") b.checkins += 1;
      if (r.event_name === "chat_send") b.chats += 1;
    }

    if (r.event_name === "auth_success") loginSuccessCount += 1;
    if (r.event_name === "party_create_success") partySuccessCount += 1;
    if (r.event_name === "checkin_publish_success") checkinSuccessCount += 1;
    if (r.event_name === "screen_view") {
      const sc = typeof r.props?.screen === "string" && r.props.screen.trim() ? r.props.screen.trim() : "unknown";
      screenCounts.set(sc, (screenCounts.get(sc) ?? 0) + 1);
    }

    if (!actorPlatform.has(actor)) actorPlatform.set(actor, r.platform);
    if (r.app_version && !actorVersion.has(actor)) actorVersion.set(actor, `${r.platform} ${r.app_version}`);
    if (r.theme && !actorTheme.has(actor)) actorTheme.set(actor, r.theme);
    if (r.locale && !actorLocale.has(actor)) actorLocale.set(actor, r.locale);
  }

  const daily: DailyActivityPoint[] = dayKeys.map((day) => {
    const b = dayBuckets.get(day)!;
    return {
      day,
      activeUsers: b.users.size,
      sessions: b.sessions.size,
      events: b.events,
      partySuccess: b.parties,
      checkinSuccess: b.checkins,
      chats: b.chats,
    };
  });

  const avgDau =
    daily.length > 0
      ? Math.round((daily.reduce((acc, d) => acc + d.activeUsers, 0) / daily.length) * 10) / 10
      : 0;

  const countMap = (m: Map<string, string>) => {
    const out = new Map<string, number>();
    for (const v of m.values()) out.set(v, (out.get(v) ?? 0) + 1);
    return out;
  };

  const authFunnel = buildFunnel(
    "auth",
    "登入／註冊漏斗（Logon）",
    windowRows,
    [
      { key: "open", label: "打開登入頁", match: (r) => r.event_name === "auth_open" },
      { key: "submit", label: "提交登入／驗證", match: (r) => r.event_name === "auth_submit" },
      { key: "success", label: "登入成功", match: (r) => r.event_name === "auth_success" },
    ],
    "auth_abandon",
    "auth_failed",
    "auth_success",
  );

  const partyCreateFunnel = buildFunnel(
    "party_create",
    "發佈酒局漏斗（Party Publish）",
    windowRows,
    [
      { key: "open", label: "進入發起酒局", match: (r) => r.event_name === "party_create_open" },
      {
        key: "step2",
        label: "進入第 2 步（地點與細節）",
        match: (r) => r.event_name === "party_create_step_view" && String(r.props?.step ?? "") === "step2",
      },
      { key: "submit", label: "點擊發佈酒局", match: (r) => r.event_name === "party_create_submit" },
      { key: "success", label: "發佈成功", match: (r) => r.event_name === "party_create_success" },
    ],
    "party_create_abandon",
    "party_create_failed",
    "party_create_success",
  );

  const checkinFunnel = buildFunnel(
    "checkin",
    "拍照打卡發佈漏斗（Check-in）",
    windowRows,
    [
      { key: "open", label: "打開相機／選圖", match: (r) => r.event_name === "checkin_open" },
      { key: "photo", label: "完成拍照／選圖進編輯", match: (r) => r.event_name === "checkin_photo_ready" },
      { key: "publish_open", label: "進入發佈預覽頁", match: (r) => r.event_name === "checkin_publish_open" },
      { key: "submit", label: "點擊發佈打卡", match: (r) => r.event_name === "checkin_publish_submit" },
      { key: "success", label: "發佈成功", match: (r) => r.event_name === "checkin_publish_success" },
    ],
    "checkin_abandon",
    "checkin_publish_failed",
    "checkin_publish_success",
  );

  return {
    days,
    platform: platformFilter,
    totalEvents: windowRows.length,
    dauToday: dauSet.size,
    wau7d: wauSet.size,
    mau30d: mauSet.size,
    avgDau,
    totalSessions: allSessions.size,
    loginSuccessCount,
    partySuccessCount,
    checkinSuccessCount,
    daily,
    funnels: {
      auth: authFunnel,
      partyCreate: partyCreateFunnel,
      checkin: checkinFunnel,
    },
    platforms: toBreakdown(countMap(actorPlatform), 4),
    versions: toBreakdown(countMap(actorVersion), 8),
    themes: toBreakdown(countMap(actorTheme), 4),
    locales: toBreakdown(countMap(actorLocale), 4),
    screens: toBreakdown(screenCounts, 8),
  };
}

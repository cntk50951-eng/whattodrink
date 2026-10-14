"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  arriveErrorKey,
  arriveWindowOpen,
  attendanceOutcomeKey,
} from "@/lib/partyUi";

type AttMember = {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  arrived: boolean;
  host_marked: boolean | null;
};

type AttState = {
  pending: boolean;
  role: string | null;
  closes_at: string | null;
  window_closed: boolean;
  members: AttMember[];
  host: { nickname: string | null; arrived: boolean } | null;
  my_host_attended: boolean | null;
  my_outcome: string | null;
};

function asAttState(j: unknown): AttState | null {
  if (typeof j !== "object" || j === null) return null;
  const r = j as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const members: AttMember[] = [];
  if (Array.isArray(r.members)) {
    for (const m of r.members) {
      if (typeof m !== "object" || m === null) continue;
      const rec = m as Record<string, unknown>;
      if (typeof rec.user_id !== "string" || rec.user_id === "") continue;
      members.push({
        user_id: rec.user_id,
        nickname: str(rec.nickname),
        avatar_url: str(rec.avatar_url),
        arrived: rec.arrived === true,
        host_marked: typeof rec.host_marked === "boolean" ? rec.host_marked : null,
      });
    }
  }
  const h = typeof r.host === "object" && r.host !== null ? (r.host as Record<string, unknown>) : null;
  return {
    pending: r.pending === true,
    role: str(r.role),
    closes_at: str(r.closes_at),
    window_closed: r.window_closed === true,
    members,
    host: h !== null ? { nickname: str(h.nickname), arrived: h.arrived === true } : null,
    my_host_attended: typeof r.my_host_attended === "boolean" ? r.my_host_attended : null,
    my_outcome: str(r.my_outcome),
  };
}

function oneShotPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("no-geo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error("denied")),
      { timeout: 15000, maximumAge: 60_000 },
    );
  });
}

/**
 * UR G.8 到場＋出席區（v2-only；掛酒局詳情內）。
 * 我到了（窗口內才出鈕，單次定位＋POST arrive，隱私文案常顯）／
 * host 標記成員（marks 一次送）／成員回報發起人有無到／結算 outcome。
 * 窗口判定全以服務端為準，409 人話透傳（iOS 口徑）。
 */
export function V2PartyAttendance({
  partyId,
  startAt,
  isHost,
  isMember,
}: {
  partyId: string;
  startAt: string;
  isHost: boolean;
  isMember: boolean;
}) {
  const t = useTranslations("v2");
  // 相對時間錨點（render 內禁 Date.now，mount 快照，沿 E.10 口徑）。
  const [nowMs] = useState(() => Date.now());
  const [st, setSt] = useState<AttState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch(`/api/v1/parties/${encodeURIComponent(partyId)}/attendance`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`attendance ${res.status}`);
      const j = (await res.json().catch(() => null)) as unknown;
      const s = asAttState(j);
      if (s === null) throw new Error("bad");
      setSt(s);
      const init: Record<string, boolean> = {};
      for (const m of s.members) {
        if (m.host_marked !== null) init[m.user_id] = m.host_marked;
        else if (m.arrived) init[m.user_id] = true;
      }
      setMarks(init);
    } catch {
      setFailed(true);
    }
  }, [partyId]);

  useEffect(() => {
    if (!isHost && !isMember) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 進詳情拉一次屬 props-sync（沿 V2NewsSheet 口径）
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 進詳情拉一次（id 變即詳情變，沿 openDetail 口径）
  }, [partyId]);

  async function arrive(): Promise<void> {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const pos = await oneShotPosition().catch(() => null);
      if (pos === null) {
        setErr(t("partyArriveNoPos"));
        return;
      }
      const res = await fetch(`/api/v1/parties/${encodeURIComponent(partyId)}/arrive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(pos),
      });
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) {
        const code = typeof j?.error?.code === "string" ? j.error.code : null;
        const key = arriveErrorKey(code);
        setErr(key !== null ? t(key) : (j?.error?.message ?? t("partyActFail")));
        return;
      }
      setOk(t("partyArrivedOk"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveMarks(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const payload = Object.entries(marks).map(([user_id, attended]) => ({ user_id, attended }));
      const res = await fetch(`/api/v1/parties/${encodeURIComponent(partyId)}/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ marks: payload }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) throw new Error(j?.error?.message ?? "mark failed");
      setOk(t("partyAttendSaved"));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("partyActFail"));
    } finally {
      setBusy(false);
    }
  }

  async function markHost(attended: boolean): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/parties/${encodeURIComponent(partyId)}/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ host_attended: attended }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? "mark failed");
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("partyActFail"));
    } finally {
      setBusy(false);
    }
  }

  if (!isHost && !isMember) return null;
  if (failed) return null;

  const startMs = Date.parse(startAt);
  const showArrive = arriveWindowOpen(startMs, nowMs);
  const outcomeKey = attendanceOutcomeKey(st?.my_outcome ?? null);

  return (
    <div className="rounded-xl border p-3">
      <p className="pb-2 text-sm font-bold">{t("partyAttendTitle")}</p>
      {err !== null && (
        <p role="alert" className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs">
          {err}
        </p>
      )}
      {ok !== null && (
        <p role="status" className="mb-2 text-xs text-green-600">
          {ok}
        </p>
      )}
      {showArrive && (
        <div className="flex flex-col gap-1.5 pb-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void arrive()}
            className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {t("partyArrived")}
          </button>
          <p className="text-xs text-muted-foreground">{t("partyArrivePrivacy")}</p>
        </div>
      )}
      {st === null ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <span className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {outcomeKey !== null && <p className="text-xs font-bold text-muted-foreground">{t(outcomeKey)}</p>}
          {st.host !== null && (
            <p className="text-xs">
              {t("partyAttendHost")}{st.host.nickname ?? t("friendFallback")} ·{" "}
              {st.host.arrived ? t("partyAttendArrived") : t("partyAttendNotArrived")}
            </p>
          )}
          {!isHost && !st.window_closed && !st.pending && (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs font-bold">{t("partyHostDidCome")}</span>
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  disabled={busy}
                  onClick={() => void markHost(v)}
                  aria-pressed={st.my_host_attended === v}
                  className={`rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50 ${st.my_host_attended === v ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {v ? t("partyYes") : t("partyNo")}
                </button>
              ))}
            </div>
          )}
          {isHost && !st.pending && (
            <div className="flex flex-col gap-2">
              <ul className="flex flex-col gap-1.5">
                {st.members.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-bold">{m.nickname ?? t("friendFallback")}</span>
                    {m.arrived && <span className="text-green-600">✓</span>}
                    <button
                      type="button"
                      disabled={busy || st.window_closed}
                      onClick={() => setMarks((p) => ({ ...p, [m.user_id]: !(p[m.user_id] ?? false) }))}
                      aria-pressed={marks[m.user_id] === true}
                      className={`rounded-full border px-2.5 py-1 font-bold disabled:opacity-50 ${marks[m.user_id] === true ? "bg-primary text-primary-foreground" : ""}`}
                    >
                      {t("partyAttendMarked")}
                    </button>
                  </li>
                ))}
              </ul>
              {!st.window_closed && st.members.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveMarks()}
                  className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {t("partyAttendSave")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

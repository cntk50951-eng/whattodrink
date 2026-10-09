"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Crown, Martini, ShieldCheck } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDistance } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";
import { remainHM } from "@/lib/wantRecord";
import {
  partyJoinState,
  partyMixLine,
  partyProgress,
  type PartyJoinState,
} from "@/lib/api/party";
import { V2PartyForm } from "./V2PartyForm";
import styles from "./v2.module.css";

type PartyHost = { user_id: string; nickname: string; avatar_url: string | null };

type PartyRow = {
  id: string;
  place: string;
  city: string;
  start_at: string;
  expires_at: string;
  seats_total: number;
  seats_male: number;
  seats_female: number;
  min_members: number;
  bill_intent: string;
  status: string;
  joined_count: number;
  male_count: number;
  female_count: number;
  host: PartyHost;
  joined_by_me: boolean;
  is_mine: boolean;
  distance_m: number | null;
};

type PartyMember = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  gender: string | null;
  joined_at: string;
  is_host: boolean;
};

type PartyDetail = PartyRow & { members: PartyMember[] };

function asPartyRow(r: unknown): PartyRow | null {
  if (typeof r !== "object" || r === null) return null;
  const rec = r as Record<string, unknown>;
  if (typeof rec.id !== "string") return null;
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const host =
    typeof rec.host === "object" && rec.host !== null
      ? (rec.host as Record<string, unknown>)
      : null;
  return {
    id: rec.id,
    place: typeof rec.place === "string" ? rec.place : "",
    city: typeof rec.city === "string" ? rec.city : "",
    start_at: typeof rec.start_at === "string" ? rec.start_at : "",
    expires_at: typeof rec.expires_at === "string" ? rec.expires_at : "",
    seats_total: num(rec.seats_total),
    seats_male: num(rec.seats_male),
    seats_female: num(rec.seats_female),
    min_members: num(rec.min_members),
    bill_intent: typeof rec.bill_intent === "string" ? rec.bill_intent : "flexible",
    status: typeof rec.status === "string" ? rec.status : "open",
    joined_count: num(rec.joined_count),
    male_count: num(rec.male_count),
    female_count: num(rec.female_count),
    host: {
      user_id: typeof host?.user_id === "string" ? host.user_id : "",
      nickname:
        typeof host?.nickname === "string" && host.nickname !== "" ? host.nickname : "酒友",
      avatar_url: typeof host?.avatar_url === "string" ? host.avatar_url : null,
    },
    joined_by_me: rec.joined_by_me === true,
    is_mine: rec.is_mine === true,
    distance_m: typeof rec.distance_m === "number" ? rec.distance_m : null,
  };
}

function billLabel(bill: string, t: (k: string) => string): string {
  return bill === "host" ? t("billHost") : bill === "aa" ? t("billAa") : t("billFlexible");
}

function fmtTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function genderMark(g: string | null): string | null {
  if (g === "male") return "♂";
  if (g === "female") return "♀";
  return null;
}

/**
 * UR G.3 酒局看板（v2-only；对标 iOS PartyBoard／Detail；探索／我的双籤＋详情＋发局三态）。
 * 行卡：店名＋城市·距离＋时间·买单＋席位条 X/Y席＋构成 capsule＋发起人＋行内动作
 * （你是发起人／已参加／参加键／满员锁／已撤销）；详情：标题＋成局 badge＋发起人卡＋
 * 地点盒＋时间买单盒＋席位＋成员（皇冠＋♂♀＋入席时间）＋动作（撤局两段确认）＋安全盒。
 */
export function V2PartySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("v2");
  const { position } = useGeolocation();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [view, setView] = useState<{ kind: "list" } | { kind: "detail"; id: string } | { kind: "form" }>({
    kind: "list",
  });
  const [items, setItems] = useState<PartyRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<PartyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // UR E.10：相对时间锚点（render 内禁 Date.now impure，mount 快照一次，沿列表页口径）。
  const [nowMs] = useState(() => Date.now());

  function say(msg: string): void {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 1500);
  }

  const load = useCallback(
    async (box: "all" | "mine") => {
      setFailed(false);
      setNeedLogin(false);
      try {
        const near = position === null ? "" : `&near=${position.lat},${position.lng}`;
        const res = await fetch(`/api/v1/parties?limit=20${box === "mine" ? "&box=mine" : ""}${near}`, {
          credentials: "include",
        });
        if (res.status === 401 && box === "mine") {
          setItems([]);
          setNeedLogin(true);
          return;
        }
        if (!res.ok) throw new Error(`parties ${res.status}`);
        const j = (await res.json()) as { items?: unknown[] };
        const rows = Array.isArray(j.items) ? j.items : [];
        const mapped: PartyRow[] = [];
        for (const r of rows) {
          const m = asPartyRow(r);
          if (m !== null) mapped.push(m);
        }
        setItems(mapped);
      } catch {
        setFailed(true);
      }
    },
    [position],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open／切籤即拉属 props-sync（沿 V2SavesSheet 口径）
    if (open) void load(tab);
  }, [open, tab, load]);

  const openDetail = useCallback(async (id: string) => {
    setView({ kind: "detail", id });
    setDetail(null);
    setDetailLoading(true);
    setActionErr(null);
    setConfirmCancel(false);
    try {
      const res = await fetch(`/api/v1/parties/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`party ${res.status}`);
      const j = (await res.json()) as Record<string, unknown>;
      const row = asPartyRow(j);
      if (row === null) throw new Error("bad");
      const members = Array.isArray(j.members)
        ? (j.members as Record<string, unknown>[])
            .filter((m) => typeof m.user_id === "string")
            .map((m) => ({
              user_id: m.user_id as string,
              nickname: typeof m.nickname === "string" && m.nickname !== "" ? m.nickname : "酒友",
              avatar_url: typeof m.avatar_url === "string" ? (m.avatar_url as string) : null,
              gender: typeof m.gender === "string" ? (m.gender as string) : null,
              joined_at: typeof m.joined_at === "string" ? (m.joined_at as string) : "",
              is_host: m.is_host === true,
            }))
        : [];
      setDetail({ ...row, members });
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function errText(res: Response, j: { error?: { code?: unknown; message?: unknown } } | null, fallback: string): string {
    const code = typeof j?.error?.code === "string" ? j.error.code : "";
    if (res.status === 401) return t("partyNeedLogin");
    if (code === "party_full") return t("partyFull");
    if (code === "gender_full") return t("partyGenderFull");
    if (res.status === 410) return t("partyGone");
    if (res.status === 404) return t("partyTestOff");
    return typeof j?.error?.message === "string" ? j.error.message : fallback;
  }

  async function act(path: string, init: RequestInit, after: () => Promise<void>): Promise<void> {
    setBusyId(path);
    setActionErr(null);
    try {
      const res = await fetch(path, { credentials: "include", ...init });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: { code?: unknown; message?: unknown };
        } | null;
        throw new Error(errText(res, j, `${res.status}`));
      }
      await after();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "bad";
      setActionErr(msg);
      say(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function joinById(id: string, refreshDetail: boolean): Promise<void> {
    await act(`/api/v1/parties/${encodeURIComponent(id)}/joins`, { method: "POST" }, async () => {
      await load(tab);
      if (refreshDetail) await openDetail(id);
    });
  }

  function login(): void {
    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback?next=/v2` },
        });
      } catch {}
    })();
  }

  const d = view.kind === "detail" ? detail : null;

  function remainText(expiresIso: string): string | null {
    const ms = Date.parse(expiresIso);
    if (!Number.isFinite(ms)) return null;
    const r = remainHM(ms, nowMs);
    if (r === null) return null;
    if (r.h > 0) return t("partyRemainHM", { h: r.h, m: r.m });
    return t("partyRemainM", { m: r.m });
  }

  function stateOf(r: PartyRow): PartyJoinState {
    return partyJoinState(r.status, r.is_mine, r.joined_by_me, r.joined_count, r.seats_total);
  }

  function joinButton(r: PartyRow, inDetail: boolean): React.ReactNode {
    const st = stateOf(r);
    if (st === "cancelled") {
      return <p className="text-xs font-bold text-muted-foreground">{t("partyCancelledShort")}</p>;
    }
    if (st === "host") {
      return <p className="text-xs font-bold text-primary">{t("partyHostYouRow")}</p>;
    }
    if (st === "joined") {
      return <p className="text-xs font-bold text-green-600">{t("partyJoinedNote")}</p>;
    }
    const full = st === "full";
    const busy = busyId !== null;
    return (
      <button
        type="button"
        disabled={full || busy}
        onClick={() => void joinById(r.id, inDetail)}
        aria-label={full ? t("partyFull") : t("partyJoin")}
        className={`w-full rounded-xl px-3 py-2 text-sm font-bold text-white disabled:opacity-60 ${
          full || busy ? "bg-muted-foreground" : "bg-primary"
        }`}
      >
        {busyId === `/api/v1/parties/${r.id}/joins` ? "…" : full ? t("partyFull") : t("partyJoin")}
      </button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[85svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("partyTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("partyTitle")}</SheetDescription>
        </SheetHeader>
        {toast !== null && (
          <p role="status" className="rounded-full bg-foreground px-4 py-1.5 text-center text-sm font-medium text-background">
            {toast}
          </p>
        )}

        {view.kind === "form" ? (
          <V2PartyForm
            lat={position?.lat ?? null}
            lng={position?.lng ?? null}
            onDone={() => {
              setView({ kind: "list" });
              void load(tab);
            }}
            onCancel={() => setView({ kind: "list" })}
          />
        ) : view.kind === "detail" ? (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setView({ kind: "list" })} className="self-start text-sm text-muted-foreground">
              ← {t("partyTitle")}
            </button>
            {detailLoading || d === null ? (
              <div className="flex flex-col gap-2" aria-hidden>
                <span className="h-5 w-1/2 animate-pulse rounded-md bg-muted" />
                <span className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
                <span className="h-28 animate-pulse rounded-xl bg-muted" />
              </div>
            ) : (
              <>
                <div>
                  <p className="flex items-center gap-2 text-base font-bold">
                    {d.place}
                    {d.joined_count >= d.min_members && d.min_members > 0 ? (
                      <span className="rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-bold text-green-600">
                        {t("partyConfirmed")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {t("partyForming")}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[d.city, fmtTime(d.start_at), remainText(d.expires_at)].filter((s) => s !== "" && s !== null).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl bg-primary/[0.08] p-3">
                  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Crown size={18} className="text-primary" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {t("partyHostTop")}：{d.host.nickname}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {d.is_mine ? t("partyHostYouSub") : t("partyHostOtherSub")}
                    </span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-xl bg-muted p-2.5">
                    <p className="text-xs text-muted-foreground">{t("partyVenueTime")}</p>
                    <p className="truncate text-sm font-bold">{fmtTime(d.start_at)}</p>
                  </div>
                  <div className="flex-1 rounded-xl bg-muted p-2.5">
                    <p className="text-xs text-muted-foreground">{t("partyBill")}</p>
                    <p className="truncate text-sm font-bold">{billLabel(d.bill_intent, t)}</p>
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="flex items-center justify-between text-sm font-bold">
                    <span>
                      {t("partySeats")} {d.joined_count}/{d.seats_total}
                    </span>
                    <span className={d.joined_count >= d.seats_total ? "text-muted-foreground" : "text-green-600"}>
                      {d.joined_count >= d.seats_total
                        ? t("partyFull")
                        : t("partySeatsLeft", { n: d.seats_total - d.joined_count })}
                    </span>
                  </p>
                  <span className="mt-2 block h-2.5 overflow-hidden rounded-full bg-muted">
                    <span
                      aria-hidden
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(partyProgress(d.joined_count, d.seats_total) * 100)}%` }}
                    />
                  </span>
                  {partyMixLine(d.male_count, d.female_count, d.seats_male, d.seats_female) !== "" && (
                    <p className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                      {partyMixLine(d.male_count, d.female_count, d.seats_male, d.seats_female)}
                    </p>
                  )}
                </div>
                {d.members.length > 0 && (
                  <div className="rounded-xl border p-3">
                    <p className="pb-2 text-sm font-bold">{t("partyMembers", { n: d.members.length })}</p>
                    <ul className="flex flex-col gap-2">
                      {d.members.map((m) => (
                        <li key={m.user_id} className="flex items-center gap-2 text-sm">
                          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                            {m.nickname.slice(0, 1)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{m.nickname}</span>
                          {genderMark(m.gender) !== null && (
                            <span className="text-xs text-muted-foreground">{genderMark(m.gender)}</span>
                          )}
                          {m.is_host && <Crown size={14} aria-hidden className="shrink-0 text-primary" />}
                          {m.joined_at !== "" && (
                            <span className="shrink-0 text-xs text-muted-foreground">{fmtTime(m.joined_at)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {actionErr !== null && (
                  <p role="alert" className="text-xs text-destructive">{actionErr}</p>
                )}
                <div className="flex flex-col gap-2">
                  {stateOf(d) === "joined" ? (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() =>
                        void act(`/api/v1/parties/${encodeURIComponent(d.id)}/joins`, { method: "DELETE" }, async () => {
                          await openDetail(d.id);
                          await load(tab);
                        })
                      }
                      className="w-full rounded-xl border px-3 py-2.5 text-sm font-bold disabled:opacity-50"
                    >
                      {t("partyLeave")}
                    </button>
                  ) : (
                    joinButton(d, true)
                  )}                  {d.is_mine && d.status !== "cancelled" && (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => {
                        if (!confirmCancel) {
                          setConfirmCancel(true);
                          return;
                        }
                        setConfirmCancel(false);
                        void act(`/api/v1/parties/${encodeURIComponent(d.id)}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "cancel" }),
                        }, async () => {
                          await openDetail(d.id);
                          await load(tab);
                        });
                      }}
                      className="w-full rounded-xl border border-destructive px-3 py-2.5 text-sm font-bold text-destructive disabled:opacity-50"
                    >
                      {confirmCancel ? t("partyConfirmCancel") : t("partyCancelAction")}
                    </button>
                  )}
                </div>
                <p className="flex items-start gap-1.5 rounded-xl bg-muted p-2 text-xs text-muted-foreground">
                  <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
                  {t("partySafety")}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1 rounded-full bg-muted p-1" role="tablist">
                {(["all", "mine"] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="tab"
                    aria-selected={tab === b}
                    onClick={() => setTab(b)}
                    className={`flex-1 rounded-full px-3 py-1 text-sm font-bold ${
                      tab === b ? "bg-card shadow" : "text-muted-foreground"
                    }`}
                  >
                    {b === "all" ? t("partyExplore") : t("partyMine")}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setView({ kind: "form" })}
                className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground"
              >
                {t("partyPublish")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void resetTest()}
              className="w-full py-1 text-center text-xs text-muted-foreground"
            >
              {t("partyTestReset")}
            </button>
            {needLogin ? (
              <div className="flex items-center gap-2 py-6 text-sm">
                <span className="text-muted-foreground">{t("partyNeedLogin")}</span>
                <button type="button" className="font-bold text-primary" onClick={login}>
                  {t("savesLoginCta")}
                </button>
              </div>
            ) : items === null && !failed ? (
              <div className="flex flex-col gap-2" aria-hidden>
                {[1, 2, 3].map((n) => (
                  <span key={n} className="h-[120px] animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : failed ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <p role="alert" className="text-sm text-muted-foreground">{t("partyFailed")}</p>
                <button
                  type="button"
                  onClick={() => void load(tab)}
                  className="rounded-full border px-3 py-1.5 text-sm font-bold"
                >
                  {t("newsRetry")}
                </button>
              </div>
            ) : items !== null && items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Martini size={36} aria-hidden className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tab === "mine" ? t("partyEmptyMine") : t("partyEmpty")}
                </p>
                <button
                  type="button"
                  onClick={() => setView({ kind: "form" })}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  {t("partyPublish")}
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {(items ?? []).map((r) => (
                  <li key={r.id} className="rounded-xl border bg-card p-3">
                    <button
                      type="button"
                      onClick={() => void openDetail(r.id)}
                      className="block w-full text-left"
                      aria-label={`${r.place}，${r.joined_count}/${r.seats_total}`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-bold">{r.place}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {[r.city, r.distance_m !== null ? formatDistance(r.distance_m) : ""]
                            .filter((s) => s !== "")
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="block truncate pt-0.5 text-sm text-muted-foreground">
                        {fmtTime(r.start_at)} · {billLabel(r.bill_intent, t)}
                        {remainText(r.expires_at) !== null ? ` · ${remainText(r.expires_at)}` : ""}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            aria-hidden
                            className={`block h-full rounded-full ${r.joined_count >= r.seats_total ? "bg-muted-foreground" : "bg-primary"}`}
                            style={{ width: `${Math.round(partyProgress(r.joined_count, r.seats_total) * 100)}%` }}
                          />
                        </span>
                        <span className="shrink-0 text-xs font-bold text-muted-foreground">
                          {r.joined_count}/{r.seats_total}席
                        </span>
                      </span>
                      {(partyMixLine(r.male_count, r.female_count, r.seats_male, r.seats_female) !== "" ||
                        r.host.nickname !== "") && (
                        <span className="mt-1.5 flex items-center gap-2 text-xs">
                          {partyMixLine(r.male_count, r.female_count, r.seats_male, r.seats_female) !== "" && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                              {partyMixLine(r.male_count, r.female_count, r.seats_male, r.seats_female)}
                            </span>
                          )}
                          <span className="truncate text-muted-foreground">
                            {t("partyHostTop")}：{r.host.nickname}
                          </span>
                        </span>
                      )}
                    </button>
                    <span className="mt-2 block">{joinButton(r, false)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );

  async function resetTest(): Promise<void> {
    try {
      const res = await fetch("/api/v1/parties/mine/today", {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 404) {
        say(t("partyTestOff"));
        return;
      }
      if (!res.ok) throw new Error(`${res.status}`);
      const j = (await res.json()) as { deleted?: unknown };
      say(typeof j.deleted === "number" ? `${t("partyTestOk")}: ${j.deleted}` : t("partyTestOk"));
      await load(tab);
    } catch {
      say(t("partyTestOk"));
    }
  }
}

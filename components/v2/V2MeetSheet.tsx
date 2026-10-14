"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MeetCriteria } from "@/lib/meet";
import {
  meetChips,
  meetCriteriaWithout,
  meetDistanceText,
  meetEmptyExplanation,
  meetErrorKind,
  meetProgressText,
  meetScoreText,
  type MeetChipKind,
} from "@/lib/meetUi";
import styles from "./v2.module.css";

type MeetResult = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  gender: string | null;
  age: number | null;
  score: number;
  match: "full" | "partial" | null;
  reasons: string[];
  height_cm: number | null;
  occupation: string | null;
  languages: string[];
  interests: string[];
  taste_headline: string | null;
  mutual_friends_count: number | null;
  distance_m: number | null;
  online: boolean | null;
  relationship: "friend" | "none" | "pending_out" | "pending_in" | string;
};

type SearchResponse = {
  criteria: MeetCriteria;
  ignored: string[];
  results: unknown[];
  relaxed?: { note: string; criteria: MeetCriteria } | null;
  remaining_today: number;
  stats?: { pool: number; passed: number } | null;
  friends_not_discoverable?: number | null;
  notes?: string[];
};

function asMeetResult(r: unknown): MeetResult | null {
  if (typeof r !== "object" || r === null) return null;
  const rec = r as Record<string, unknown>;
  if (typeof rec.user_id !== "string" || typeof rec.nickname !== "string") return null;
  if (typeof rec.score !== "number" || !Array.isArray(rec.reasons)) return null;
  const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const match = rec.match === "full" || rec.match === "partial" ? rec.match : null;
  return {
    user_id: rec.user_id,
    nickname: rec.nickname,
    avatar_url: strOrNull(rec.avatar_url),
    gender: strOrNull(rec.gender),
    age: numOrNull(rec.age),
    score: rec.score,
    match,
    reasons: strArr(rec.reasons).slice(0, 3),
    height_cm: numOrNull(rec.height_cm),
    occupation: strOrNull(rec.occupation),
    languages: strArr(rec.languages),
    interests: strArr(rec.interests),
    taste_headline: strOrNull(rec.taste_headline),
    mutual_friends_count: numOrNull(rec.mutual_friends_count),
    distance_m: numOrNull(rec.distance_m),
    online: typeof rec.online === "boolean" ? rec.online : null,
    relationship: typeof rec.relationship === "string" ? rec.relationship : "none",
  };
}

type Phase = "loading" | "consent" | "input" | "searching" | "results";

const QUERY_MAX = 100;

/**
 * UR G.6 遇見 AI 找人（v2-only；對標 iOS MeetView 全流程，web Sheet 形態）。
 * status→同意→輸入→搜索中→結果卡；條件 chips 可點掉走 criteria 重搜（不扣次數）；
 * 0 結果 relaxed 一鍵放寬＋匿名統計解釋；卡片動作＝加好友（可附留言）／傾偈，資訊行內展。
 */
export function V2MeetSheet({
  open,
  onClose,
  onChat,
}: {
  open: boolean;
  onClose: () => void;
  onChat: (userId: string) => void;
}) {
  const t = useTranslations("v2");
  const [phase, setPhase] = useState<Phase>("loading");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [criteria, setCriteria] = useState<MeetCriteria>({});
  const [ignored, setIgnored] = useState<string[]>([]);
  const [results, setResults] = useState<MeetResult[]>([]);
  const [relaxed, setRelaxed] = useState<{ note: string; criteria: MeetCriteria } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [stats, setStats] = useState<{ pool: number; passed: number } | null>(null);
  const [friendsHint, setFriendsHint] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [relOverride, setRelOverride] = useState<Record<string, string>>({});
  const [msgFor, setMsgFor] = useState<string | null>(null);
  const [msgText, setMsgText] = useState("");
  const [avatarBroken, setAvatarBroken] = useState<Record<string, boolean>>({});
  const trackRef = useRef<HTMLDivElement | null>(null);

  const errText = useCallback(
    (status: number, code: string | null, serverMsg: string | null): string => {
      switch (meetErrorKind(status, code)) {
        case "unauthorized":
          return t("meetErrAuth");
        case "onboardingRequired":
          return t("meetErrOnboard");
        case "ageRestricted":
          return t("meetErrAge");
        case "quotaExhausted":
          return t("meetErrQuota");
        case "aiUnavailable":
          return t("meetErrAi");
        case "notDeployed":
          return t("meetErrDeployed");
        case "rejected":
        case "other":
          return serverMsg !== null && serverMsg !== "" ? serverMsg : t("meetErrOther");
      }
    },
    [t],
  );

  const loadStatus = useCallback(async () => {
    setPhase("loading");
    setErr(null);
    try {
      const res = await fetch("/api/v1/meet/status", { cache: "no-store", credentials: "include" });
      const j = (await res.json().catch(() => null)) as {
        discoverable?: boolean | null;
        remaining_today?: number;
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || j === null) {
        setErr(errText(res.status, j?.error?.code ?? null, j?.error?.message ?? null));
        return;
      }
      setRemaining(typeof j.remaining_today === "number" ? j.remaining_today : null);
      if (j.discoverable === null || j.discoverable === undefined) setPhase("consent");
      else setPhase("input");
    } catch {
      setErr(t("meetErrOther"));
    }
  }, [errText, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開 sheet 即拉屬 props-sync（沿 V2NewsSheet 口径）
    if (open) void loadStatus();
  }, [open, loadStatus]);

  // 搜索中輪播提示 tick（iOS meetProgressText 口徑；半秒一格累加，免 Date.now purity 門）。
  useEffect(() => {
    if (phase !== "searching") return;
    const id = window.setInterval(() => setElapsed((e) => e + 0.5), 500);
    return () => window.clearInterval(id);
  }, [phase]);

  async function patchDiscoverable(v: boolean): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ discoverable: v }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) {
        setErr(errText(res.status, j?.error?.code ?? null, j?.error?.message ?? null));
        return;
      }
      setPhase("input");
    } catch {
      setErr(t("meetErrOther"));
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(body: { query?: string; criteria?: MeetCriteria }): Promise<void> {
    setBusy(true);
    setErr(null);
    setElapsed(0);
    setPhase("searching");
    try {
      const res = await fetch("/api/v1/meet/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => null)) as (SearchResponse & {
        error?: { code?: string; message?: string };
      }) | null;
      if (!res.ok || j === null) {
        setErr(errText(res.status, j?.error?.code ?? null, j?.error?.message ?? null));
        setPhase("input");
        return;
      }
      const rows: MeetResult[] = [];
      for (const r of Array.isArray(j.results) ? j.results : []) {
        const m = asMeetResult(r);
        if (m !== null) rows.push(m);
      }
      setCriteria(typeof j.criteria === "object" && j.criteria !== null ? j.criteria : {});
      setIgnored(Array.isArray(j.ignored) ? j.ignored.filter((x): x is string => typeof x === "string") : []);
      setResults(rows);
      setRelaxed(j.relaxed !== null && typeof j.relaxed === "object" ? (j.relaxed as { note: string; criteria: MeetCriteria }) : null);
      setNotes(Array.isArray(j.notes) ? j.notes.filter((x): x is string => typeof x === "string") : []);
      setStats(j.stats !== null && typeof j.stats === "object" ? (j.stats as { pool: number; passed: number }) : null);
      setFriendsHint(typeof j.friends_not_discoverable === "number" ? j.friends_not_discoverable : null);
      if (typeof j.remaining_today === "number") setRemaining(j.remaining_today);
      setCardIdx(0);
      trackRef.current?.scrollTo({ left: 0 });
      setPhase("results");
    } catch {
      setErr(t("meetErrOther"));
      setPhase("input");
    } finally {
      setBusy(false);
    }
  }

  function dropChip(kind: MeetChipKind): void {
    const next = meetCriteriaWithout(criteria, kind);
    void runSearch({ criteria: next });
  }

  async function addFriend(userId: string): Promise<void> {
    setErr(null);
    try {
      const res = await fetch("/api/v1/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          friend_id: userId,
          ...(msgText.trim() !== "" ? { message: msgText.trim().slice(0, 50) } : {}),
        }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) {
        setErr(j?.error?.message ?? t("meetErrOther"));
        return;
      }
      setRelOverride((prev) => ({ ...prev, [userId]: "pending_out" }));
      setMsgFor(null);
      setMsgText("");
    } catch {
      setErr(t("meetErrOther"));
    }
  }

  const chips = meetChips(criteria, {
    female: t("meetFemale"),
    male: t("meetMale"),
    ageBelow: (hi) => t("meetAgeBelow", { hi }),
    ageAbove: (lo) => t("meetAgeAbove", { lo }),
    ageExact: (n) => t("meetAgeExact", { n }),
    ageRange: (lo, hi) => t("meetAgeRange", { lo, hi }),
    heightBelow: (hi) => t("meetHeightBelow", { hi }),
    heightAbove: (lo) => t("meetHeightAbove", { lo }),
    heightRange: (lo, hi) => t("meetHeightRange", { lo, hi }),
    nearby: (km) => t("meetNearby", { km }),
    online: t("meetOnline"),
  });

  const examples = [t("meetEx1"), t("meetEx2"), t("meetEx3"), t("meetEx4")];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[85svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("meetTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("meetTitle")}</SheetDescription>
        </SheetHeader>
        {remaining !== null && phase !== "loading" && (
          <p className="text-xs text-muted-foreground">{t("meetRemaining", { n: remaining })}</p>
        )}
        {err !== null && (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-sm">
            {err}
          </p>
        )}

        {phase === "loading" && (
          <div className="flex flex-col gap-2" aria-hidden>
            {[1, 2].map((n) => (
              <span key={n} className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        )}

        {phase === "consent" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold">{t("meetConsentTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("meetConsentBody")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void patchDiscoverable(true)}
                className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {t("meetAllow")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void patchDiscoverable(false)}
                className="flex-1 rounded-full border px-3 py-2 text-sm font-bold disabled:opacity-50"
              >
                {t("meetDeny")}
              </button>
            </div>
          </div>
        )}

        {phase === "input" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-bold">
              {t("meetQueryLabel")}
              <textarea
                value={query}
                maxLength={QUERY_MAX}
                rows={2}
                placeholder={t("meetQueryPh")}
                onChange={(e) => setQuery(e.target.value)}
                className="rounded-xl border p-2 text-sm font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setQuery(ex)}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  {ex}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || query.trim() === ""}
              onClick={() => void runSearch({ query: query.trim() })}
              className="rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {t("meetSearch")}
            </button>
          </div>
        )}

        {phase === "searching" && (
          <div className="flex flex-col items-center gap-2 py-8" role="status">
            <span aria-hidden className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">
              {meetProgressText(elapsed, [t("meetStage1"), t("meetStage2"), t("meetStage3"), t("meetStage4")])}
            </p>
          </div>
        )}

        {phase === "results" && (
          <div className="flex flex-col gap-3">
            {chips.length > 0 && (
              <div>
                <p className="pb-1 text-xs font-bold text-muted-foreground">{t("meetCriteriaLabel")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((c, i) => (
                    <button
                      key={`${c.label}-${i}`}
                      type="button"
                      onClick={() => dropChip(c.kind)}
                      aria-label={`${c.label} ×`}
                      className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                    >
                      {c.label}
                      <X size={12} aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {ignored.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("meetIgnoredLabel")}{ignored.join("、")}
              </p>
            )}
            {notes.map((n, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {n}
              </p>
            ))}
            {results.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="py-2 text-sm whitespace-pre-line">
                  {meetEmptyExplanation(stats, friendsHint, Object.keys(criteria).length > 0, {
                    poolEmpty: t("meetEmptyPool"),
                    nonePassed: (p) => t("meetEmptyNone", { pool: p }),
                    somePassed: (p, q) => t("meetEmptySome", { pool: p, passed: q }),
                    friendsHint: (n) => t("meetEmptyFriends", { n }),
                    fallbackWithCriteria: t("meetEmptyRelax"),
                    fallbackNoCriteria: t("meetEmptySayMore"),
                  })}
                </p>
                {relaxed !== null && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runSearch({ criteria: relaxed.criteria })}
                    className="rounded-full border px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    {t("meetRelaxedGo", { note: relaxed.note })}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {t("meetProgress", { i: Math.min(cardIdx + 1, results.length), n: results.length })}
                </p>
                <div
                  ref={trackRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const w = el.clientWidth || 1;
                    setCardIdx(Math.min(results.length - 1, Math.round(el.scrollLeft / w)));
                  }}
                  className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1"
                >
                  {results.map((r) => {
                    const rel = relOverride[r.user_id] ?? r.relationship;
                    const dist = meetDistanceText(r.distance_m, t("meetNear"), t("meetKm"));
                    return (
                      <article
                        key={r.user_id}
                        className="flex w-[85%] shrink-0 snap-center flex-col gap-2 rounded-2xl border p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          {r.avatar_url !== null && !avatarBroken[r.user_id] ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={r.avatar_url}
                              alt=""
                              loading="lazy"
                              onError={() => setAvatarBroken((p) => ({ ...p, [r.user_id]: true }))}
                              className="h-12 w-12 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold"
                            >
                              {r.nickname.slice(0, 1)}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-bold">{r.nickname}</p>
                            <p className="text-xs text-muted-foreground">
                              {[
                                r.gender === "female" ? t("meetFemale") : r.gender === "male" ? t("meetMale") : null,
                                r.age !== null ? t("meetAgeExact", { n: r.age }) : null,
                                r.online === true ? t("meetOnlineNow") : null,
                              ]
                                .filter((s): s is string => s !== null)
                                .join(" · ")}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                            {meetScoreText(r.score, t("meetScoreSuffix"))}
                          </span>
                        </div>
                        {r.match !== null && (
                          <p className="text-xs font-bold text-muted-foreground">
                            {r.match === "full" ? t("meetMatchFull") : t("meetMatchPartial")}
                          </p>
                        )}
                        {r.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {r.reasons.map((s, i) => (
                              <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                        {(r.taste_headline !== null ||
                          r.height_cm !== null ||
                          r.occupation !== null ||
                          r.languages.length > 0 ||
                          r.interests.length > 0 ||
                          r.mutual_friends_count !== null ||
                          dist !== null) && (
                          <dl className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                            {r.taste_headline !== null && (
                              <div className="flex gap-1">
                                <dt className="shrink-0 font-bold">{t("meetTaste")}</dt>
                                <dd>{r.taste_headline}</dd>
                              </div>
                            )}
                            {(r.height_cm !== null || r.occupation !== null) && (
                              <div className="flex gap-1">
                                <dt className="shrink-0 font-bold">{t("meetProfile")}</dt>
                                <dd>
                                  {[
                                    r.height_cm !== null ? `${r.height_cm}cm` : null,
                                    r.occupation,
                                  ]
                                    .filter((s): s is string => s !== null && s !== "")
                                    .join(" · ")}
                                </dd>
                              </div>
                            )}
                            {(r.languages.length > 0 || r.interests.length > 0) && (
                              <div className="flex gap-1">
                                <dt className="shrink-0 font-bold">{t("meetTags")}</dt>
                                <dd className="break-words">{[...r.languages, ...r.interests].join(" · ")}</dd>
                              </div>
                            )}
                            {(r.mutual_friends_count !== null || dist !== null) && (
                              <div className="flex gap-1">
                                <dt className="shrink-0 font-bold">{t("meetSocial")}</dt>
                                <dd>
                                  {[
                                    r.mutual_friends_count !== null && r.mutual_friends_count > 0
                                      ? t("meetMutual", { n: r.mutual_friends_count })
                                      : null,
                                    dist,
                                  ]
                                    .filter((s): s is string => s !== null)
                                    .join(" · ")}
                                </dd>
                              </div>
                            )}
                          </dl>
                        )}
                        {rel === "friend" ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onChat(r.user_id)}
                              className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                            >
                              {t("meetChat")}
                            </button>
                          </div>
                        ) : rel === "pending_out" || rel === "pending_in" ? (
                          <p className="rounded-full bg-muted px-3 py-2 text-center text-sm">{t("meetPending")}</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setMsgFor(msgFor === r.user_id ? null : r.user_id);
                                  setMsgText("");
                                }}
                                className="flex-1 rounded-full border px-3 py-2 text-sm font-bold"
                              >
                                {t("meetAddFriend")}
                              </button>
                              <button
                                type="button"
                                onClick={() => onChat(r.user_id)}
                                className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                              >
                                {t("meetChat")}
                              </button>
                            </div>
                            {msgFor === r.user_id && (
                              <div className="flex gap-2">
                                <input
                                  value={msgText}
                                  maxLength={50}
                                  placeholder={t("meetMessagePh")}
                                  onChange={(e) => setMsgText(e.target.value)}
                                  className="min-w-0 flex-1 rounded-full border px-3 py-1.5 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => void addFriend(r.user_id)}
                                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground"
                                >
                                  {t("meetSend")}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
                {results.length > 1 && (
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      aria-label={t("meetPrev")}
                      onClick={() => {
                        const el = trackRef.current;
                        if (el === null) return;
                        el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
                      }}
                      className="rounded-full border p-2"
                    >
                      <ChevronLeft size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t("meetNext")}
                      onClick={() => {
                        const el = trackRef.current;
                        if (el === null) return;
                        el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
                      }}
                      className="rounded-full border p-2"
                    >
                      <ChevronRight size={16} aria-hidden />
                    </button>
                  </div>
                )}
                {relaxed !== null && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runSearch({ criteria: relaxed.criteria })}
                    className="rounded-full border px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    {t("meetRelaxedGo", { note: relaxed.note })}
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setPhase("input");
                setErr(null);
              }}
              className="rounded-full border px-3 py-2 text-sm font-bold"
            >
              {t("meetNewSearch")}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

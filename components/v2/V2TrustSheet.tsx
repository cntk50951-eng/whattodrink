"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatWantTime } from "@/lib/wantRecord";
import { parseTrustLedgerItem, parseTrustTier, trustTierWarning, type TrustLedgerItem } from "@/lib/complaintUi";
import styles from "./v2.module.css";

type TrustTierKey = "trustTierNewbie" | "trustTierTrusted" | "trustTierNormal" | "trustTierWatch" | "trustTierRestricted";

function tierKeyOf(tier: string): TrustTierKey {
  switch (parseTrustTier(tier)) {
    case "trusted":
      return "trustTierTrusted";
    case "normal":
      return "trustTierNormal";
    case "watch":
      return "trustTierWatch";
    case "restricted":
      return "trustTierRestricted";
    default:
      return "trustTierNewbie";
  }
}

function blurbKeyOf(tier: string): "trustBlurbNewbie" | "trustBlurbTrusted" | "trustBlurbNormal" | "trustBlurbWatch" | "trustBlurbRestricted" {
  switch (parseTrustTier(tier)) {
    case "trusted":
      return "trustBlurbTrusted";
    case "normal":
      return "trustBlurbNormal";
    case "watch":
      return "trustBlurbWatch";
    case "restricted":
      return "trustBlurbRestricted";
    default:
      return "trustBlurbNewbie";
  }
}

function timeOf(locale: string, iso: string | null): string {
  if (iso === null) return "";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? formatWantTime(ms, locale) : "";
}

/**
 * UR G.8b 我的誠信（v2-only；`GET /me/trust`）。
 * 分數等級全服務端算；新手不外露分數（iOS showsScore 口徑）；賬本倒序＋更多。
 */
export function V2TrustSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const [score, setScore] = useState<number | null>(null);
  const [tier, setTier] = useState("newbie");
  const [completed, setCompleted] = useState(0);
  const [hosted, setHosted] = useState(0);
  const [cancel90, setCancel90] = useState(0);
  const [late90, setLate90] = useState(0);
  const [ledger, setLedger] = useState<TrustLedgerItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      setErr(null);
      try {
        const qs = after !== null ? `?limit=20&cursor=${encodeURIComponent(after)}` : "?limit=20";
        const res = await fetch(`/api/v1/me/trust${qs}`, { cache: "no-store", credentials: "include" });
        const j = (await res.json().catch(() => null)) as {
          score?: number;
          tier?: string;
          completed_count?: number;
          hosted_count?: number;
          cancel_90d?: number;
          leave_late_90d?: number;
          ledger?: unknown[];
          nextCursor?: string | null;
          error?: { message?: string };
        } | null;
        if (!res.ok || j === null) throw new Error(j?.error?.message ?? "load failed");
        if (after === null) {
          if (typeof j.score === "number") setScore(Math.round(j.score));
          if (typeof j.tier === "string") setTier(j.tier);
          if (typeof j.completed_count === "number") setCompleted(j.completed_count);
          if (typeof j.hosted_count === "number") setHosted(j.hosted_count);
          if (typeof j.cancel_90d === "number") setCancel90(j.cancel_90d);
          if (typeof j.leave_late_90d === "number") setLate90(j.leave_late_90d);
        }
        const rows: TrustLedgerItem[] = [];
        for (const r of Array.isArray(j.ledger) ? j.ledger : []) {
          const m = parseTrustLedgerItem(r);
          if (m !== null) rows.push(m);
        }
        setLedger((prev) => (after === null ? rows : [...prev, ...rows]));
        setCursor(typeof j.nextCursor === "string" && j.nextCursor !== "" ? j.nextCursor : null);
      } catch {
        setErr(t("trustLoadFail"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開 sheet 即拉屬 props-sync（沿 V2NewsSheet 口径）
    if (open) void load(null);
  }, [open, load]);

  const tierV = parseTrustTier(tier);
  const showScore = tierV !== "newbie";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("trustTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("trustTitle")}</SheetDescription>
        </SheetHeader>
        {err !== null && (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-sm">
            {err}
          </p>
        )}
        <div className={`flex items-center gap-3 rounded-xl border p-3 ${trustTierWarning(tierV) ? "border-destructive/40" : ""}`}>
          <span
            aria-hidden
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${trustTierWarning(tierV) ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
          >
            <ShieldCheck size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold">
              {showScore && score !== null ? `${score} · ` : ""}
              {t(tierKeyOf(tier))}
            </span>
            <span className="block text-xs text-muted-foreground">{t(blurbKeyOf(tier))}</span>
          </span>
        </div>
        <div className="flex gap-2">
          {[
            { k: t("trustCompleted"), v: completed },
            { k: t("trustHosted"), v: hosted },
            { k: t("trustCancel90"), v: cancel90 },
            { k: t("trustLate90"), v: late90 },
          ].map((s) => (
            <div key={s.k} className="flex-1 rounded-xl bg-muted p-2 text-center">
              <p className="text-base font-bold">{s.v}</p>
              <p className="text-xs text-muted-foreground">{s.k}</p>
            </div>
          ))}
        </div>
        {ledger.length === 0 ? (
          loading ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {[1, 2].map((n) => (
                <span key={n} className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("trustLedgerEmpty")}</p>
          )
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center gap-2.5 rounded-xl border p-2 text-sm">
                <span
                  aria-hidden
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${l.delta >= 0 ? "bg-green-600/10 text-green-600" : "bg-destructive/10 text-destructive"}`}
                >
                  {l.delta >= 0 ? `+${l.delta}` : `${l.delta}`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{l.reason !== "" ? l.reason : t("trustLedgerFallback")}</span>
                  {l.created_at !== null && (
                    <span className="block text-xs text-muted-foreground">{timeOf(locale, l.created_at)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {cursor !== null && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(cursor)}
            className="rounded-full border px-3 py-2 text-sm font-bold disabled:opacity-50"
          >
            {t("noticeMore")}
          </button>
        )}
      </SheetContent>
    </Sheet>
  );
}

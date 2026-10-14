"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlarmClock,
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  CheckCircle2,
  Dices,
  Flag,
  MessageSquare,
  TriangleAlert,
  UserX,
  XCircle,
} from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatWantTime } from "@/lib/wantRecord";
import {
  noticeActorName,
  noticeDetail,
  noticeIcon,
  noticeIsComplaint,
  noticePlace,
  noticeTitle,
  noticeUrgent,
  parseNotice,
  type NoticeIcon,
  type PartyNotice,
} from "@/lib/activity";
import styles from "./v2.module.css";

const ICONS: Record<NoticeIcon, typeof Bell> = {
  cancel: XCircle,
  leaveLate: TriangleAlert,
  leave: UserX,
  trustUp: ArrowUpCircle,
  trustDown: ArrowDownCircle,
  alarm: AlarmClock,
  game: Dices,
  complaint: Flag,
  complaintResult: MessageSquare,
  check: CheckCircle2,
  bell: Bell,
};

function timeOf(locale: string, iso: string | null): string {
  if (iso === null) return "";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? formatWantTime(ms, locale) : "";
}

type TierKey = "trustTierNewbie" | "trustTierTrusted" | "trustTierNormal" | "trustTierWatch" | "trustTierRestricted";

function tierOf(t: (k: TierKey) => string, tier: string): string {
  switch (tier) {
    case "newbie":
      return t("trustTierNewbie");
    case "trusted":
      return t("trustTierTrusted");
    case "normal":
      return t("trustTierNormal");
    case "watch":
      return t("trustTierWatch");
    case "restricted":
      return t("trustTierRestricted");
    default:
      return tier;
  }
}

/**
 * UR G.7 酒局通知列表（v2-only；`GET /me/notifications`＋`PATCH read` 全标已读）。
 * 未知 kind 兜底通用行不丟（iOS 口徑）；投訴行點即關（詳情頁在 G.8，暫只讀）。
 */
export function V2NoticesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const [items, setItems] = useState<PartyNotice[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      setErr(null);
      try {
        const qs = after !== null ? `?limit=20&cursor=${encodeURIComponent(after)}` : "?limit=20";
        const res = await fetch(`/api/v1/me/notifications${qs}`, { cache: "no-store", credentials: "include" });
        const j = (await res.json().catch(() => null)) as {
          items?: unknown[];
          nextCursor?: string | null;
          error?: { message?: string };
        } | null;
        if (!res.ok || j === null) throw new Error(j?.error?.message ?? "load failed");
        const rows: PartyNotice[] = [];
        for (const r of Array.isArray(j.items) ? j.items : []) {
          const n = parseNotice(r);
          if (n !== null) rows.push(n);
        }
        setItems((prev) => (after === null ? rows : [...prev, ...rows]));
        setCursor(typeof j.nextCursor === "string" && j.nextCursor !== "" ? j.nextCursor : null);
      } catch {
        setErr(t("noticeLoadFail"));
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

  async function markAll(): Promise<void> {
    setMarking(true);
    try {
      const res = await fetch("/api/v1/me/notifications/read", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("mark failed");
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      setErr(t("noticeMarkFail"));
    } finally {
      setMarking(false);
    }
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("noticeTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("noticeTitle")}</SheetDescription>
        </SheetHeader>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {unread > 0 ? t("noticeUnread", { n: unread }) : t("noticeAllRead")}
          </p>
          {unread > 0 && (
            <button
              type="button"
              disabled={marking}
              onClick={() => void markAll()}
              className="rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50"
            >
              {t("noticeMarkAll")}
            </button>
          )}
        </div>
        {err !== null && (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-sm">
            {err}
          </p>
        )}
        {items.length === 0 ? (
          loading ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {[1, 2, 3].map((n) => (
                <span key={n} className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("noticeEmpty")}</p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((n) => {
              const Icon = ICONS[noticeIcon(n)];
              const urgent = noticeUrgent(n);
              const place = noticePlace(n, t("partyFallback"));
              const actor = noticeActorName(n, t("friendFallback"));
              const title = noticeTitle(n, place, actor);
              const d = noticeDetail(n);
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-2.5 rounded-xl border p-2 ${urgent ? "border-destructive/40" : ""} ${n.read ? "opacity-70" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{t(title.key, title.params)}</span>
                    {d.kind === "startsAt" && (
                      <span className="block text-xs text-muted-foreground">{t("noticeStartsAt", { time: timeOf(locale, d.startAt) })}</span>
                    )}
                    {d.kind === "dueAt" && (
                      <span className="block text-xs text-muted-foreground">{t("noticeDueAt", { time: timeOf(locale, d.dueAt) })}</span>
                    )}
                    {d.kind === "confirmBy" && (
                      <span className="block text-xs text-muted-foreground">{t("noticeConfirmBy", { time: timeOf(locale, d.closesAt) })}</span>
                    )}
                    {d.kind === "trust" && (
                      <span className="block text-xs text-muted-foreground">
                        {[d.reason, d.tier !== null ? t("noticeTierNow", { tier: tierOf(t, d.tier) }) : null]
                          .filter((s): s is string => s !== null && s !== "")
                          .join(" · ")}
                      </span>
                    )}
                    {d.kind === "note" && <span className="block text-xs text-muted-foreground">{d.note}</span>}
                    {d.kind === "gameRequest" && (
                      <span className="block text-xs text-muted-foreground">{t("noticeGameRequestHint")}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {[timeOf(locale, n.created_at), noticeIsComplaint(n) ? t("noticeComplaintTag") : null]
                        .filter((s): s is string => s !== null && s !== "")
                        .join(" · ")}
                    </span>
                  </span>
                  {!n.read && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive" />}
                </li>
              );
            })}
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

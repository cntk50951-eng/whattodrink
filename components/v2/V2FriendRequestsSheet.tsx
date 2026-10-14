"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatWantTime } from "@/lib/wantRecord";
import { parseFriendRequest, type FriendRequest } from "@/lib/activity";
import styles from "./v2.module.css";

type Box = "incoming" | "outgoing";

function timeOf(locale: string, iso: string | null): string {
  if (iso === null) return "";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? formatWantTime(ms, locale) : "";
}

function originKey(origin: string | null): string {
  switch (origin) {
    case "cheers":
      return "reqOriginCheers";
    case "party":
      return "reqOriginParty";
    case "checkin":
      return "reqOriginCheckin";
    case "game":
      return "reqOriginGame";
    case "profile":
      return "reqOriginProfile";
    default:
      return "reqOriginDirect";
  }
}

/**
 * UR G.7 好友請求中心（v2-only；`GET /friends/requests` 雙籤＋`PATCH :id` 接受／拒絕／取消）。
 * web 此前全缺此 UI（B.3 只有 API）；接受後進聊天沿 D.7（onChat），會話由調用方建。
 */
export function V2FriendRequestsSheet({
  open,
  onClose,
  onChat,
}: {
  open: boolean;
  onClose: () => void;
  onChat: (userId: string) => void;
}) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const [box, setBox] = useState<Box>("incoming");
  const [items, setItems] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(
    async (b: Box) => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/v1/friends/requests?box=${b}`, { cache: "no-store", credentials: "include" });
        const j = (await res.json().catch(() => null)) as {
          items?: unknown[];
          error?: { message?: string };
        } | null;
        if (!res.ok || j === null) throw new Error(j?.error?.message ?? "load failed");
        const rows: FriendRequest[] = [];
        for (const r of Array.isArray(j.items) ? j.items : []) {
          const m = parseFriendRequest(r);
          if (m !== null) rows.push(m);
        }
        setItems(rows);
      } catch {
        setErr(t("reqLoadFail"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開 sheet／切籤即拉屬 props-sync（沿 V2NewsSheet 口径）
    if (open) void load(box);
  }, [open, box, load]);

  async function act(id: string, action: "accept" | "decline" | "cancel", peerId?: string): Promise<void> {
    setActing(id);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/friends/requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) throw new Error(j?.error?.message ?? "action failed");
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (action === "accept" && peerId !== undefined) onChat(peerId);
    } catch {
      setErr(t("reqActFail"));
    } finally {
      setActing(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("reqTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("reqTitle")}</SheetDescription>
        </SheetHeader>
        <div className="flex gap-1 rounded-full bg-muted p-1" role="tablist">
          {(["incoming", "outgoing"] as Box[]).map((b) => (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={box === b}
              onClick={() => setBox(b)}
              className={`flex-1 rounded-full px-3 py-1 text-sm font-bold ${box === b ? "bg-card shadow" : "text-muted-foreground"}`}
            >
              {b === "incoming" ? t("reqIncoming") : t("reqOutgoing")}
            </button>
          ))}
        </div>
        {err !== null && (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-sm">
            {err}
          </p>
        )}
        {items.length === 0 ? (
          loading ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {[1, 2].map((n) => (
                <span key={n} className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("reqEmpty")}</p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5 rounded-xl border p-2">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-base font-bold text-muted-foreground"
                >
                  {r.peer.nickname.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {r.peer.nickname}
                    {r.peer.gender === "female" ? ` ${t("meetFemale")}` : r.peer.gender === "male" ? ` ${t("meetMale")}` : ""}
                  </span>
                  {r.message !== null && <span className="block truncate text-xs">「{r.message}」</span>}
                  <span className="block truncate text-xs text-muted-foreground">
                    {[t(originKey(r.origin)), timeOf(locale, r.created_at)].filter((s) => s !== "").join(" · ")}
                  </span>
                </span>
                {box === "incoming" ? (
                  <span className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={acting !== null}
                      onClick={() => void act(r.id, "accept", r.peer.user_id)}
                      aria-label={t("reqAccept")}
                      className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-50"
                    >
                      <UserPlus size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={acting !== null}
                      onClick={() => void act(r.id, "decline")}
                      className="rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                    >
                      {t("reqDecline")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={acting !== null}
                    onClick={() => void act(r.id, "cancel")}
                    className="rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                  >
                    {t("reqCancel")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

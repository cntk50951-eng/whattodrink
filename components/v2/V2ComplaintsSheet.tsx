"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Flag } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatWantTime } from "@/lib/wantRecord";
import {
  COMPLAINT_APPEAL_MAX,
  COMPLAINT_RESPONSE_MAX,
  complaintStatusKey,
  complaintTextValid,
  type ComplaintCategory,
} from "@/lib/complaintUi";
import styles from "./v2.module.css";

type Role = "filed" | "against";

type ComplaintRow = {
  id: string;
  category: ComplaintCategory | null;
  status: string;
  my_role: string | null;
  peer_name: string | null;
  detail: string | null;
  response_text: string | null;
  response_due_at: string | null;
  decision: string | null;
  decision_note: string | null;
  created_at: string | null;
  can_respond: boolean;
  can_appeal: boolean;
};

function parseRow(raw: unknown): ComplaintRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return null;
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const cp = typeof r.counterpart === "object" && r.counterpart !== null ? (r.counterpart as Record<string, unknown>) : null;
  const nick = cp !== null && typeof cp.nickname === "string" && cp.nickname.trim() !== "" ? cp.nickname.trim() : null;
  const cat = typeof r.category === "string" ? r.category : "";
  return {
    id: r.id,
    category: ["no_show", "mismatch", "harassment", "safety", "other"].includes(cat) ? (cat as ComplaintCategory) : null,
    status: typeof r.status === "string" ? r.status : "",
    my_role: str(r.my_role),
    peer_name: nick,
    detail: str(r.detail),
    response_text: str(r.response_text),
    response_due_at: str(r.response_due_at),
    decision: str(r.decision),
    decision_note: str(r.decision_note),
    created_at: str(r.created_at),
    can_respond: r.can_respond === true,
    can_appeal: r.can_appeal === true,
  };
}

function catKey(c: ComplaintCategory | null): string {
  switch (c) {
    case "no_show":
      return "cplCatNoShow";
    case "mismatch":
      return "cplCatMismatch";
    case "harassment":
      return "cplCatHarass";
    case "safety":
      return "cplCatSafety";
    default:
      return "cplCatOther";
  }
}

function timeOf(locale: string, iso: string | null): string {
  if (iso === null) return "";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? formatWantTime(ms, locale) : "";
}

/**
 * UR G.8b 我的投訴（v2-only；`GET /me/complaints` 雙籤＋respond／appeal）。
 * 證據本期不做；判定扣分全服務端。
 */
export function V2ComplaintsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const [role, setRole] = useState<Role>("filed");
  const [items, setItems] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(
    async (r: Role) => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/v1/me/complaints?role=${r}&limit=20`, { cache: "no-store", credentials: "include" });
        const j = (await res.json().catch(() => null)) as {
          items?: unknown[];
          error?: { message?: string };
        } | null;
        if (!res.ok || j === null) throw new Error(j?.error?.message ?? "load failed");
        const rows: ComplaintRow[] = [];
        for (const x of Array.isArray(j.items) ? j.items : []) {
          const m = parseRow(x);
          if (m !== null) rows.push(m);
        }
        setItems(rows);
      } catch {
        setErr(t("cplLoadFail"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開 sheet／切籤即拉屬 props-sync（沿 V2NewsSheet 口径）
    if (open) void load(role);
  }, [open, role, load]);

  async function submit(id: string, kind: "respond" | "appeal", max: number): Promise<void> {
    if (!complaintTextValid(text, max)) {
      setErr(t("cplTextBad", { n: max }));
      return;
    }
    setActing(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/complaints/${encodeURIComponent(id)}/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: text.trim() }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) throw new Error(j?.error?.message ?? "submit failed");
      setText("");
      await load(role);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("cplActFail"));
    } finally {
      setActing(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("cplTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("cplTitle")}</SheetDescription>
        </SheetHeader>
        <div className="flex gap-1 rounded-full bg-muted p-1" role="tablist">
          {(["filed", "against"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={role === r}
              onClick={() => {
                setRole(r);
                setOpenId(null);
                setText("");
              }}
              className={`flex-1 rounded-full px-3 py-1 text-sm font-bold ${role === r ? "bg-card shadow" : "text-muted-foreground"}`}
            >
              {r === "filed" ? t("cplFiled") : t("cplAgainst")}
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
            <p className="py-6 text-center text-sm text-muted-foreground">{t("cplEmpty")}</p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((c) => {
              const expanded = openId === c.id;
              const hot = c.can_respond || c.can_appeal;
              return (
                <li key={c.id} className={`rounded-xl border p-2 ${hot ? "border-destructive/40" : ""}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(expanded ? null : c.id);
                      setText("");
                    }}
                    className="flex w-full items-center gap-2.5 text-left"
                  >
                    <span
                      aria-hidden
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${hot ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
                    >
                      <Flag size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {t(catKey(c.category))}
                        {c.peer_name !== null ? ` · ${c.peer_name}` : ""}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[t(complaintStatusKey(c.status, c.my_role)), timeOf(locale, c.created_at)]
                          .filter((s) => s !== "")
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                  {expanded && (
                    <div className="flex flex-col gap-2 pt-2">
                      {c.detail !== null && <p className="text-xs">「{c.detail}」</p>}
                      {c.response_text !== null && (
                        <p className="text-xs text-muted-foreground">
                          {t("cplResponse")}{c.response_text}
                        </p>
                      )}
                      {c.decision_note !== null && (
                        <p className="text-xs text-muted-foreground">
                          {t("cplDecision")}{c.decision_note}
                        </p>
                      )}
                      {c.can_respond && (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs font-bold">
                            {t("cplRespondHint")}
                            {c.response_due_at !== null ? `（${timeOf(locale, c.response_due_at)}）` : ""}
                          </p>
                          <textarea
                            value={text}
                            maxLength={COMPLAINT_RESPONSE_MAX}
                            rows={2}
                            placeholder={t("cplRespondPh")}
                            onChange={(e) => setText(e.target.value)}
                            className="rounded-xl border p-2 text-sm"
                          />
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => void submit(c.id, "respond", COMPLAINT_RESPONSE_MAX)}
                            className="rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                          >
                            {t("cplRespondSend")}
                          </button>
                        </div>
                      )}
                      {c.can_appeal && !c.can_respond && (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs font-bold">{t("cplAppealHint")}</p>
                          <textarea
                            value={text}
                            maxLength={COMPLAINT_APPEAL_MAX}
                            rows={2}
                            placeholder={t("cplAppealPh")}
                            onChange={(e) => setText(e.target.value)}
                            className="rounded-xl border p-2 text-sm"
                          />
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => void submit(c.id, "appeal", COMPLAINT_APPEAL_MAX)}
                            className="rounded-full border px-3 py-1.5 text-sm font-bold disabled:opacity-50"
                          >
                            {t("cplAppealSend")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

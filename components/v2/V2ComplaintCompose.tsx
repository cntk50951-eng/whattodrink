"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";

import {
  COMPLAINT_DETAIL_MAX,
  complaintCategoryBlock,
  complaintErrorKey,
  complaintTargets,
  complaintTextValid,
  complaintWindow,
  type ComplaintCategory,
  type ComplaintTarget,
} from "@/lib/complaintUi";

const CATS: { v: ComplaintCategory; title: string; hint: string }[] = [
  { v: "no_show", title: "cplCatNoShow", hint: "cplHintNoShow" },
  { v: "mismatch", title: "cplCatMismatch", hint: "cplHintMismatch" },
  { v: "harassment", title: "cplCatHarass", hint: "cplHintHarass" },
  { v: "safety", title: "cplCatSafety", hint: "cplHintSafety" },
  { v: "other", title: "cplCatOther", hint: "cplHintOther" },
];

/**
 * UR G.8b 投訴發起（v2-only；掛酒局詳情內，`POST /parties/:id/complaints`）。
 * 類別／窗口本機預判＋服務端為準；證據本期不做；投訴自己服務端 400。
 */
export function V2ComplaintCompose({
  partyId,
  endMs,
  cancelled,
  members,
  myUserId,
}: {
  partyId: string;
  endMs: number;
  cancelled: boolean;
  members: ComplaintTarget[];
  myUserId: string | null;
}) {
  const t = useTranslations("v2");
  const [nowMs] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [cat, setCat] = useState<ComplaintCategory>("no_show");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const targets = complaintTargets(members, myUserId);
  const target = targets.find((m) => m.user_id === targetId) ?? null;
  const window = complaintWindow(endMs, nowMs);
  const block = complaintCategoryBlock(cat, window, target?.is_host === true, cancelled);

  async function submit(): Promise<void> {
    if (target === null || block !== null) return;
    if (!complaintTextValid(detail, COMPLAINT_DETAIL_MAX)) {
      setErr(t("cplTextBad", { n: COMPLAINT_DETAIL_MAX }));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/parties/${encodeURIComponent(partyId)}/complaints`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target_user_id: target.user_id, category: cat, detail: detail.trim() }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) {
        const code = typeof j?.error?.code === "string" ? j.error.code : null;
        const key = complaintErrorKey(code);
        throw new Error(key !== null ? t(key) : (j?.error?.message ?? t("cplActFail")));
      }
      setDone(true);
      setDetail("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("cplActFail"));
    } finally {
      setBusy(false);
    }
  }

  if (targets.length === 0) return null;

  return (
    <div className="rounded-xl border p-3">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setErr(null);
          setDone(false);
        }}
        className="flex w-full items-center gap-2 text-left text-sm font-bold"
      >
        <Flag size={16} aria-hidden className="shrink-0 text-muted-foreground" />
        {t("cplComposeTitle")}
      </button>
      {open && (
        <div className="flex flex-col gap-2 pt-2">
          {done && (
            <p role="status" className="text-xs text-green-600">
              {t("cplFiledOk")}
            </p>
          )}
          {err !== null && (
            <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs">
              {err}
            </p>
          )}
          <label className="flex flex-col gap-1 text-xs font-bold">
            {t("cplTarget")}
            <span className="flex flex-wrap gap-1.5">
              {targets.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => setTargetId(m.user_id)}
                  aria-pressed={targetId === m.user_id}
                  className={`rounded-full border px-2.5 py-1 font-bold ${targetId === m.user_id ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {m.nickname ?? t("friendFallback")}
                  {m.is_host ? " · 👑" : ""}
                </button>
              ))}
            </span>
          </label>
          <div className="flex flex-col gap-1.5">
            {CATS.map((c) => {
              const b = complaintCategoryBlock(c.v, window, target?.is_host === true, cancelled);
              return (
                <button
                  key={c.v}
                  type="button"
                  disabled={b !== null}
                  onClick={() => setCat(c.v)}
                  aria-pressed={cat === c.v}
                  className={`rounded-xl border p-2 text-left disabled:opacity-50 ${cat === c.v ? "border-primary" : ""}`}
                >
                  <span className="block text-xs font-bold">{t(c.title)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {b !== null ? t(b.key) : t(c.hint)}
                  </span>
                </button>
              );
            })}
          </div>
          <textarea
            value={detail}
            maxLength={COMPLAINT_DETAIL_MAX}
            rows={3}
            placeholder={t("cplDetailPh", { n: COMPLAINT_DETAIL_MAX })}
            onChange={(e) => setDetail(e.target.value)}
            className="rounded-xl border p-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || target === null || block !== null}
            onClick={() => void submit()}
            className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {t("cplSubmit")}
          </button>
        </div>
      )}
    </div>
  );
}

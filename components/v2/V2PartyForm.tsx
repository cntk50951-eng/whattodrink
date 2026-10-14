"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { partySlotStartAt, type PartySlot } from "@/lib/api/party";
import {
  applyPrefs,
  blankDraft,
  draftKey,
  draftMeaningful,
  parseDraft,
  parsePrefs,
  prefsFromDraft,
  prefsKey,
  type PartyDraft,
} from "@/lib/partyDraft";

const FOURTEEN_DAYS_MS = 14 * 24 * 3600_000;

/** ms → datetime-local 輸入值（本地時區；iOS 無此層，web 表單專用）。 */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * UR G.3 发局表单（v2-only；字段对 E.23 POST 校验，客户端先拦一轮，服务端终判）。
 * 时间 4 段（现在／半小时后／今晚 21:00 HKT／自定义，沿 iOS InviteSlot 口径）；
 * 地点文本（1–30，POI 限定二期）＋城市文本＋总量 2–12＋男女名额（和≤总量互锁）＋
 * 成局人数固定 2（沿 iOS 定稿，最易成局）＋买单三段＋安全提示常显。
 * 坐标取调用方传的当前位置。
 */
export function V2PartyForm({
  lat,
  lng,
  onDone,
  onCancel,
  myUserId,
  initial,
}: {
  /** 当前位置（无即禁用提交，提示开定位）。 */
  lat: number | null;
  lng: number | null;
  /** 发局成功（回列表重拉）。 */
  onDone: () => void;
  onCancel: () => void;
  /** 按帳號分桶（草稿＋偏好）；null 即匿名共用桶。 */
  myUserId?: string | null;
  /** 再開一局預填（優先於草稿＋偏好）。 */
  initial?: PartyDraft | null;
}) {
  const t = useTranslations("v2");
  // UR E.10：相对时间锚点（render 内禁 Date.now impure，mount 快照一次，沿列表页口径）。
  const [nowMs] = useState(() => Date.now());
  const uid = myUserId ?? null;
  // UR G.9：初值＝再開預填＞草稿＞偏好＞空白（mount 一次，沿 hydrate 口徑）。
  const [boot] = useState(() => {
    if (initial !== null && initial !== undefined) return { base: initial, resumed: false };
    let prefs = null;
    try {
      prefs = parsePrefs(window.localStorage.getItem(prefsKey(uid)));
    } catch {}
    const base = prefs !== null ? applyPrefs(prefs, nowMs) : blankDraft(nowMs);
    let saved: PartyDraft | null = null;
    try {
      saved = parseDraft(window.localStorage.getItem(draftKey(uid)), nowMs);
    } catch {}
    if (saved !== null) return { base: saved, resumed: true };
    return { base, resumed: false };
  });
  const [place, setPlace] = useState(boot.base.bar?.name ?? "");
  const [city, setCity] = useState(boot.base.city);
  // 草稿時間還有效即回到 custom（iOS restoredStart 口徑；parseDraft 已先過濾）。
  const [slot, setSlot] = useState<PartySlot>(boot.base.startAt !== null ? "custom" : "tonight");
  const [custom, setCustom] = useState(boot.base.startAt !== null ? toLocalInput(boot.base.startAt) : "");
  const [total, setTotal] = useState(boot.base.totalSeats);
  const [male, setMale] = useState(boot.base.maleSeats);
  const [female, setFemale] = useState(boot.base.femaleSeats);
  const [bill, setBill] = useState<"host" | "aa" | "flexible">(
    boot.base.bill === "host" || boot.base.bill === "aa" ? boot.base.bill : "flexible",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resumed, setResumed] = useState(boot.resumed);

  const openTotal = total - male - female;
  const customMs = custom === "" ? NaN : Date.parse(custom);
  const customOk =
    slot !== "custom" ||
    (Number.isFinite(customMs) && customMs > nowMs && customMs <= nowMs + FOURTEEN_DAYS_MS);
  const startMs = partySlotStartAt(slot, customMs, nowMs);
  // UR G.9：改動即存草稿（有意義才寫；退出自動留，發布成功清）。
  useEffect(() => {
    try {
      const d: PartyDraft = {
        bar: place.trim() !== "" ? { name: place.trim(), lat: null, lng: null } : null,
        city,
        startAt: Number.isFinite(startMs) ? startMs : null,
        totalSeats: total,
        maleSeats: male,
        femaleSeats: female,
        bill,
        savedAt: Date.now(),
      };
      if (!draftMeaningful(d)) return;
      window.localStorage.setItem(draftKey(uid), JSON.stringify(d));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 表單欄全量跟（存檔副作用，沿偏好寫透口徑）
  }, [place, city, slot, custom, total, male, female, bill]);
  const valid =
    place.trim().length >= 1 &&
    place.trim().length <= 30 &&
    city.trim() !== "" &&
    customOk &&
    Number.isFinite(startMs) &&
    startMs > nowMs &&
    total >= 2 &&
    total <= 12 &&
    male >= 0 &&
    female >= 0 &&
    male + female <= total &&
    lat !== null &&
    lng !== null &&
    !busy;

  async function submit(): Promise<void> {
    if (!valid || lat === null || lng === null) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/v1/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          place: place.trim(),
          city: city.trim().slice(0, 30),
          lat,
          lng,
          start_at: new Date(startMs).toISOString(),
          seats_total: total,
          seats_male: male,
          seats_female: female,
          min_members: 2,
          bill_intent: bill,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null;
        const msg = typeof j?.error?.message === "string" ? j.error.message : `${res.status}`;
        throw new Error(msg);
      }
      // UR G.9：發布成功清草稿＋記偏好（介紹不記，web 表單無此欄）。
      try {
        window.localStorage.removeItem(draftKey(uid));
        window.localStorage.setItem(
          prefsKey(uid),
          JSON.stringify(prefsFromDraft({ bar: { name: place.trim(), lat: null, lng: null }, city, startAt: startMs, totalSeats: total, maleSeats: male, femaleSeats: female, bill, savedAt: nowMs }, startMs)),
        );
      } catch {}
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "bad");
    } finally {
      setBusy(false);
    }
  }

  function stepper(label: string, value: number, set: (n: number) => void, lo: number, hi: number): React.ReactNode {
    return (
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="flex items-center gap-2">
          <Button size="sm" variant="outline" type="button" disabled={value <= lo} onClick={() => set(value - 1)} aria-label={`${label}-`}>
            −
          </Button>
          <span className="w-6 text-center font-bold" aria-live="polite">{value}</span>
          <Button size="sm" variant="outline" type="button" disabled={value >= hi} onClick={() => set(value + 1)} aria-label={`${label}+`}>
            ＋
          </Button>
        </span>
      </label>
    );
  }

  const slots: PartySlot[] = ["now", "half", "tonight", "custom"];

  return (
    <div className="flex flex-col gap-3">
      {resumed && (
        <p className="flex items-center justify-between gap-2 rounded-xl bg-muted p-2 text-xs text-muted-foreground">
          <span>{t("partyDraftBack")}</span>
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.removeItem(draftKey(uid));
              } catch {}
              setResumed(false);
            }}
            className="shrink-0 rounded-full border px-2 py-0.5 font-bold"
          >
            {t("partyDraftDrop")}
          </button>
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t("partyPlace")}</span>
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          maxLength={30}
          placeholder={t("partyPlace")}
          className="rounded-xl border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t("partyCity")}</span>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={30}
          placeholder={t("partyCity")}
          className="rounded-xl border bg-card px-3 py-2 text-sm"
        />
      </label>
      <div className="flex gap-2" role="radiogroup" aria-label={t("partyTime")}>
        {slots.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={slot === s}
            onClick={() => setSlot(s)}
            className={`flex-1 rounded-full border px-2 py-1.5 text-sm font-bold ${
              slot === s ? "border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {s === "now"
              ? t("partySlotNow")
              : s === "half"
                ? t("partySlotHalf")
                : s === "tonight"
                  ? t("partySlotTonight")
                  : t("partySlotCustom")}
          </button>
        ))}
      </div>
      {slot === "custom" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("partyTime")}</span>
          <input
            type="datetime-local"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="rounded-xl border bg-card px-3 py-2 text-sm"
          />
          {!customOk && (
            <span className="text-xs text-destructive">{t("partyTimeHint")}</span>
          )}
        </label>
      )}
      {stepper(t("partySeats"), total, (n) => {
        setTotal(n);
        if (male + female > n) {
          setFemale(Math.max(0, n - male));
        }
      }, 2, 12)}
      {stepper(t("partyMale"), male, (n) => setMale(Math.min(n, total - female)), 0, total)}
      {stepper(t("partyFemale"), female, (n) => setFemale(Math.min(n, total - male)), 0, total)}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t("partyOpen")}: {openTotal}
      </p>
      <div className="flex gap-2" role="radiogroup" aria-label={t("partyBill")}>
        {(["host", "aa", "flexible"] as const).map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={bill === b}
            onClick={() => setBill(b)}
            className={`flex-1 rounded-full border px-2 py-1.5 text-sm font-bold ${
              bill === b ? "border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {b === "host" ? t("billHost") : b === "aa" ? t("billAa") : t("billFlexible")}
          </button>
        ))}
      </div>
      <p className="flex items-start gap-1.5 rounded-xl bg-muted p-2 text-xs text-muted-foreground">
        <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
        {t("partySafety")}
      </p>
      {lat === null || lng === null ? (
        <p role="alert" className="text-xs text-destructive">{t("partyNeedPos")}</p>
      ) : null}
      {err !== null && (
        <p role="alert" className="text-xs text-destructive">{err}</p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="button" className="flex-1" disabled={!valid} onClick={() => void submit()}>
          {t("partyPublish")}
        </Button>
      </div>
    </div>
  );
}

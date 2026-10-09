"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { partySlotStartAt, type PartySlot } from "@/lib/api/party";

const FOURTEEN_DAYS_MS = 14 * 24 * 3600_000;

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
}: {
  /** 当前位置（无即禁用提交，提示开定位）。 */
  lat: number | null;
  lng: number | null;
  /** 发局成功（回列表重拉）。 */
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("v2");
  const [place, setPlace] = useState("");
  const [city, setCity] = useState("");
  const [slot, setSlot] = useState<PartySlot>("tonight");
  const [custom, setCustom] = useState("");
  const [total, setTotal] = useState(6);
  const [male, setMale] = useState(0);
  const [female, setFemale] = useState(0);
  const [bill, setBill] = useState<"host" | "aa" | "flexible">("flexible");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // UR E.10：相对时间锚点（render 内禁 Date.now impure，mount 快照一次，沿列表页口径）。
  const [nowMs] = useState(() => Date.now());

  const openTotal = total - male - female;
  const customMs = custom === "" ? NaN : Date.parse(custom);
  const customOk =
    slot !== "custom" ||
    (Number.isFinite(customMs) && customMs > nowMs && customMs <= nowMs + FOURTEEN_DAYS_MS);
  const startMs = partySlotStartAt(slot, customMs, nowMs);
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

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, MapPin, Calendar, Users, ShieldCheck, Loader2, Check, ChevronRight, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { THEME_META, validateGatheringInput, type GatheringTheme } from "@/lib/gatherings";
import styles from "./v2.module.css";

type Place = {
  place_id: string;
  display_name: string;
  name: string;
  address: string;
  lat: string;
  lon: string;
  category: string;
  source: string;
};

const STEPS = [
  { key: "basic", label: "基础信息" },
  { key: "place", label: "地点时间" },
  { key: "confirm", label: "确认发布" },
] as const;

export function V2GatheringForm() {
  const t = useTranslations("gatherings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  // form state
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<GatheringTheme>("friend_new");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(6);
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [approval, setApproval] = useState<"manual" | "auto">("manual");
  const [bring, setBring] = useState("");
  const [ageMinor, setAgeMinor] = useState<boolean | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [place, setPlace] = useState<Place | null>(null);

  // place search
  const [placeOpen, setPlaceOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const queryTimer = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const miniMapRef = useRef<HTMLDivElement | null>(null);
  const miniLeafletRef = useRef<typeof import("leaflet") | null>(null);
  const miniMapInstRef = useRef<import("leaflet").Map | null>(null);
  const miniMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const miniMarkersRef = useRef<import("leaflet").Marker[]>([]);

  async function doSearch(q: string) {
    const term = q.trim();
    if (term.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/v1/places/search?q=${encodeURIComponent(term)}`);
      const json = (await res.json()) as { places?: Place[]; error?: unknown };
      setResults(Array.isArray(json.places) ? json.places : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  // debounced search via Amap proxy
  useEffect(() => {
    if (!placeOpen) return;
    if (query.trim().length < 1) {
      queueMicrotask(() => setResults([]));
      return;
    }
    if (queryTimer.current) window.clearTimeout(queryTimer.current);
    queryTimer.current = window.setTimeout(() => {
      void doSearch(query);
    }, 350);
    return () => {
      if (queryTimer.current) window.clearTimeout(queryTimer.current);
    };
  }, [query, placeOpen]);

  // 小地图：搜索定位 + 点选定位（Leaflet + 高德/ Nominatim 双源）
  useEffect(() => {
    if (!placeOpen) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      miniLeafletRef.current = L;
      // 避免重复初始化
      if (miniMapInstRef.current !== null || miniMapRef.current === null) return;
      const map = L.map(miniMapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(place ? [Number(place.lat), Number(place.lon)] : [22.2819, 114.158], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      map.on("click", async (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        try {
          const res = await fetch(`/api/v1/places/reverse?lat=${lat}&lng=${lng}`);
          const json = (await res.json()) as { display_name?: string; lat?: string; lon?: string };
          const p: Place = {
            place_id: `rev-${lat.toFixed(5)}-${lng.toFixed(5)}`,
            display_name: json.display_name ?? `${lat.toFixed(5)},${lng.toFixed(5)}`,
            name: json.display_name?.split(",")[0] ?? `${lat.toFixed(5)},${lng.toFixed(5)}`,
            address: json.display_name ?? "",
            lat: String(lat),
            lon: String(lng),
            category: "map-pick",
            source: (json as unknown as { source?: string }).source ?? "nominatim",
          };
          setPlace(p);
        } catch {
          const p: Place = {
            place_id: `rev-${lat.toFixed(5)}-${lng.toFixed(5)}`,
            display_name: `${lat.toFixed(5)},${lng.toFixed(5)}`,
            name: `${lat.toFixed(5)},${lng.toFixed(5)}`,
            address: "",
            lat: String(lat),
            lon: String(lng),
            category: "map-pick",
            source: "nominatim",
          };
          setPlace(p);
        }
      });
      miniMapInstRef.current = map;
      // 初始选中点
      if (place) {
        const m = L.marker([Number(place.lat), Number(place.lon)]).addTo(map);
        miniMarkerRef.current = m;
      }
      setTimeout(() => map.invalidateSize(), 200);
    })();
    return () => {
      cancelled = true;
    };
  }, [placeOpen]);

  // 选中结果 → 地图飞点 + 高亮
  useEffect(() => {
    const L = miniLeafletRef.current;
    const map = miniMapInstRef.current;
    if (!L || !map) return;
    // 清旧结果点
    for (const mm of miniMarkersRef.current) map.removeLayer(mm);
    miniMarkersRef.current = [];
    for (const r of results) {
      const mm = L.marker([Number(r.lat), Number(r.lon)], { title: r.name }).addTo(map);
      mm.on("click", () => setPlace(r));
      miniMarkersRef.current.push(mm);
    }
    if (results.length > 0) {
      const first = results[0]!;
      map.flyTo([Number(first.lat), Number(first.lon)], 15, { duration: 0.5 });
    }
  }, [results]);

  // 选中地点 → 地图主标记更新
  useEffect(() => {
    const L = miniLeafletRef.current;
    const map = miniMapInstRef.current;
    if (!L || !map || !place) return;
    if (miniMarkerRef.current) map.removeLayer(miniMarkerRef.current);
    const m = L.marker([Number(place.lat), Number(place.lon)], {
      icon: L.divIcon({
        className: "",
        html: '<div style="width:28px;height:28px;border-radius:999px;background:#ff5a1f;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;color:white;font-size:14px">📍</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    }).addTo(map);
    miniMarkerRef.current = m;
    map.flyTo([Number(place.lat), Number(place.lon)], 15, { duration: 0.5 });
  }, [place]);

  function validateCurrent(): string | null {
    if (step === 0) {
      if (title.trim().length < 2) return "标题需 2–30 字";
      if (description.trim().length < 10) return "简介需 10–200 字";
    }
    if (step === 1) {
      if (!place) return "请选择地图中的地点（不支持手输）";
      if (!startsAt) return "请选择时间";
    }
    if (step === 2) {
      if (ageMinor === null) return "请申明是否有未成年人参与";
      if (ageMinor === true) return "组局不允许未成年人参与";
      if (!agreed) return "请勾选免责声明";
    }
    return null;
  }

  function next() {
    const err = validateCurrent();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(2, s + 1));
  }

  function prev() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    setError(null);
    const iso = startsAt ? new Date(startsAt).toISOString() : "";
    const input = {
      title,
      theme,
      description,
      location_text: place?.display_name ?? "",
      place_id: place ? String(place.place_id) : "",
      lat: place ? Number(place.lat) : NaN,
      lng: place ? Number(place.lon) : NaN,
      starts_at: iso,
      capacity,
      visibility,
      approval_mode: approval,
      bring_text: bring || null,
      age_has_minor: ageMinor,
      agreed,
    } as Parameters<typeof validateGatheringInput>[0];
    const errs = validateGatheringInput(input);
    if (errs.length > 0) {
      setError(errs[0]!.reason);
      // jump to relevant step
      const f = errs[0]!.field;
      if (f === "title" || f === "theme" || f === "description") setStep(0);
      else if (f === "location" || f === "time" || f === "capacity") setStep(1);
      else setStep(2);
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/v1/gatherings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          theme: input.theme,
          description: input.description,
          location_text: input.location_text,
          place_id: input.place_id,
          lat: input.lat,
          lng: input.lng,
          starts_at: input.starts_at,
          capacity: input.capacity,
          visibility: input.visibility,
          approval_mode: input.approval_mode,
          bring_text: input.bring_text,
          age_has_minor: input.age_has_minor,
          agreed: input.agreed,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string; gathering?: { id: string } };
      if (!res.ok) {
        setError(json.message ?? json.error ?? "创建失败");
        return;
      }
      const id = json.gathering?.id;
      if (id) router.push(`/v2/gatherings/${id}`);
      else router.push("/v2");
    });
  }

  return (
    <div className={`${styles.v2scope} fixed inset-0 isolate z-[1000] flex h-dvh flex-col overflow-hidden bg-background text-foreground`}>
      <header className="flex shrink-0 items-center gap-2 border-b bg-card px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="back" onClick={() => router.back()} type="button">
          <ChevronLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight">{t("newTitle")}</h1>
          <p className="truncate text-xs text-muted-foreground">以交友聚会为核心 · 仅可选地图地点 · 平台仅撮合</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 md:p-6">

        {/* Step tracker */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => {
              const active = idx === step;
              const done = idx < step;
              return (
                <div key={s.key} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full border text-sm font-medium transition-colors ${
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="size-4" /> : idx + 1}
                  </div>
                  <span className={`hidden text-sm font-medium md:block ${active ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                  {idx < STEPS.length - 1 && <div className={`mx-2 h-px flex-1 ${idx < step ? "bg-primary" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {step === 0 && <>主题与简介</>}
              {step === 1 && <>地点与时间</>}
              {step === 2 && <>设置与申明</>}
              <Badge variant="secondary" className="ml-auto">
                {step + 1} / {STEPS.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              {step === 0 && "选择以交友聚会为主的主题，写清标题与简介"}
              {step === 1 && "仅可选择地图中的地点（高德搜索），时间需 2h–14天"}
              {step === 2 && "确认人数与可见性，并申明年龄与免责"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title">
                    {t("fieldTitle")} <span className="text-destructive">*</span>
                  </Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="周末认识新朋友" maxLength={30} />
                  <p className="text-xs text-muted-foreground">{title.length}/30</p>
                </div>

                <div className="space-y-2">
                  <Label>
                    {t("fieldTheme")} <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {Object.entries(THEME_META).map(([k, m]) => {
                      const active = theme === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setTheme(k as GatheringTheme)}
                          className={`rounded-lg border p-3 text-left transition-colors ${active ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card hover:bg-muted"}`}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span>{m.icon}</span> {m.label} {active && <Check className="ml-auto size-4 text-primary" />}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc">
                    {t("fieldDesc")} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="想认识爱 CityWalk 的朋友，带什么都欢迎，一起在中环聊聊天"
                    maxLength={200}
                    rows={4}
                    className="resize-none min-h-[96px]"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>简介必填，10–200 字</span>
                    <span>{description.length}/200</span>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>
                    {t("fieldPlace")} <span className="text-destructive">*</span>
                  </Label>
                  <Button variant="outline" className="w-full justify-between" onClick={() => setPlaceOpen(true)} type="button">
                    <span className="flex items-center gap-2 truncate">
                      <MapPin className="size-4 shrink-0" />
                      {place ? place.name : t("pickPlace")}
                    </span>
                    <Search className="size-4 opacity-50" />
                  </Button>
                  {place ? (
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-sm font-medium">{place.name}</p>
                      <p className="text-xs text-muted-foreground">{place.address}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {place.lat}, {place.lon} · {place.source === "amap" ? "高德" : "OSM"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">仅可选择地图中的地点，不支持手输。搜索后从列表点选。</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="time" className="flex items-center gap-1">
                      <Calendar className="size-3.5" /> {t("fieldTime")} <span className="text-destructive">*</span>
                    </Label>
                    <Input id="time" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{t("timeHint")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cap" className="flex items-center gap-1">
                      <Users className="size-3.5" /> {t("fieldCapacity")} <span className="text-destructive">*</span>
                    </Label>
                    <Input id="cap" type="number" min={2} max={8} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
                    <p className="text-xs text-muted-foreground">2–8 人，含发起人</p>
                  </div>
                </div>

                <Separator />
                <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                  地点搜索由<strong className="text-foreground">高德地图</strong>驱动（无 Key 时自动回退 OSM），结果为真实 POI，拒绝手输与私宅类型。
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("fieldVisibility")}</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={visibility === "public" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setVisibility("public")}
                      >
                        {t("visibilityPublic")}
                      </Button>
                      <Button
                        type="button"
                        variant={visibility === "friends" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setVisibility("friends")}
                      >
                        {t("visibilityFriends")}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("fieldApproval")}</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={approval === "manual" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setApproval("manual")}
                      >
                        {t("approvalManual")}
                      </Button>
                      <Button
                        type="button"
                        variant={approval === "auto" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setApproval("auto")}
                      >
                        {t("approvalAuto")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bring">{t("fieldBring")}</Label>
                  <Input id="bring" value={bring} onChange={(e) => setBring(e.target.value)} placeholder="可选，如：带一支清酒 / 带点小食" maxLength={30} />
                  <p className="text-xs text-muted-foreground">全主题选填，仅作补充信息</p>
                </div>

                <Separator />

                <div className="space-y-3 rounded-lg border bg-card p-3">
                  <Label className="flex items-center gap-1">
                    <ShieldCheck className="size-4" /> {t("fieldAge")} <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant={ageMinor === false ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAgeMinor(false)}
                      type="button"
                      className="flex-1"
                    >
                      <Check className="mr-1 size-4" /> {t("ageNoMinor")}
                    </Button>
                    <Button
                      variant={ageMinor === true ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setAgeMinor(true)}
                      type="button"
                      className="flex-1"
                    >
                      {t("ageHasMinor")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("ageHint")}。五项审查：时间/地点/人数/描述/年龄，有未成年人直接拒绝。</p>
                </div>

                <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                  <span>{t("agreed")}</span>
                </label>
              </>
            )}

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
          </CardContent>
        </Card>

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={prev} disabled={step === 0} type="button">
            <ChevronLeft className="mr-1 size-4" /> 上一步
          </Button>
          {step < 2 ? (
            <Button onClick={next} type="button">
              下一步 <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={pending} type="button">
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {pending ? t("submitting") : t("submit")}
            </Button>
          )}
        </div>
        </div>
      </div>

      {/* Place picker dialog（小地图 + 搜索定位） */}
      <Dialog open={placeOpen} onOpenChange={setPlaceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="size-4" /> {t("pickPlace")}
            </DialogTitle>
            <DialogDescription>{t("pickPlaceHint")} · 高德搜索 + 小地图点选，拒绝手输与私宅</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索中环、尖沙咀、铜锣湾..."
                className="pl-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void doSearch(query);
                  }
                }}
              />
            </div>
            <Button onClick={() => void doSearch(query)} variant="secondary" type="button" disabled={searching}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : "搜索"}
            </Button>
          </div>
          {/* 小地图 */}
          <div ref={miniMapRef} className="h-[220px] w-full overflow-hidden rounded-lg border" />
          <p className="text-xs text-muted-foreground">在地图上点选亦可定位（点击后自动逆地理至地址），搜索结果会在地图上以标记显示。</p>
          <div className="max-h-[28vh] space-y-2 overflow-auto pr-1">
            {searching && <p className="py-6 text-center text-sm text-muted-foreground">搜索中…</p>}
            {!searching &&
              results.map((r) => (
                <button
                  key={`${r.source}-${r.place_id}`}
                  onClick={() => {
                    setPlace(r);
                    setPlaceOpen(false);
                    setQuery(r.name);
                  }}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{r.name}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {r.source === "amap" ? "高德" : "OSM"} · {r.category || "POI"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.address || r.display_name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.lat}, {r.lon}
                  </p>
                </button>
              ))}
            {!searching && results.length === 0 && query.trim().length >= 1 && (
              <p className="py-6 text-center text-xs text-muted-foreground">{t("noResult")}</p>
            )}
            {!searching && query.trim().length < 1 && (
              <p className="py-6 text-center text-xs text-muted-foreground">输入关键词后自动搜索（中环/尖沙咀/铜锣湾…）</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

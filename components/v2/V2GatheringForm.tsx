"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Search,
  MapPin,
  Calendar,
  Users,
  ShieldCheck,
  Loader2,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Edit3,
  LocateFixed,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  { key: "place", label: "选择地点" },
  { key: "info", label: "填写信息" },
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
  // editable display for pin result
  const [placeEdit, setPlaceEdit] = useState("");

  // place search - instant dropdown
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const queryTimer = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const miniMapRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const miniLeafletRef = useRef<typeof import("leaflet") | null>(null);
  const miniMapInstRef = useRef<import("leaflet").Map | null>(null);
  const miniMarkersRef = useRef<import("leaflet").Marker[]>([]);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number } | null>(null);
  // 防止程序 flyTo 触发 moveend 逆向导致轮回跳转
  const isFlyingRef = useRef(false);
  const flyTimerRef = useRef<number | null>(null);
  const placeRef = useRef<Place | null>(null);
  // render 期不写 ref（lint react-hooks/refs）：place 同步走 effect。
  useEffect(() => {
    placeRef.current = place;
  }, [place]);

  const doSearch = useCallback(async (termRaw: string) => {
    const term = termRaw.trim();
    if (term.length < 1) {
      setResults([]);
      return;
    }
    // 取消上一请求
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    try {
      const res = await fetch(`/api/v1/places/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
      const json = (await res.json()) as { places?: Place[]; error?: unknown };
      if (ctrl.signal.aborted) return;
      setResults(Array.isArray(json.places) ? json.places : []);
      setShowResults(true);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // 抖动即时搜索（step 0 地点页）
  useEffect(() => {
    if (step !== 0) return;
    if (query.trim().length < 1) {
      queueMicrotask(() => {
        setResults([]);
        setShowResults(false);
      });
      return;
    }
    if (queryTimer.current) window.clearTimeout(queryTimer.current);
    queryTimer.current = window.setTimeout(() => {
      void doSearch(query);
    }, 320) as unknown as number;
    return () => {
      if (queryTimer.current) window.clearTimeout(queryTimer.current);
    };
  }, [query, step, doSearch]);

  // 失焦延迟关闭下拉
  const handleBlur = () => {
    window.setTimeout(() => setShowResults(false), 200);
  };

  // 固定定位下拉（逃离 overflow/stacking 遮挡，始终盖过地图）
  useEffect(() => {
    if (!showResults) return;
    const upd = () => {
      const el = searchWrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDropdownPos({ left: r.left, top: r.bottom + 8, width: r.width });
    };
    upd();
    window.addEventListener("resize", upd);
    window.addEventListener("scroll", upd, true);
    return () => {
      window.removeEventListener("resize", upd);
      window.removeEventListener("scroll", upd, true);
    };
  }, [showResults, query, results.length]);

  // 选中结果：仅设 place，不触发 results 自动飞；由 place effect 单一入口飞
  const selectPlace = useCallback((p: Place) => {
    setPlace(p);
    setPlaceEdit(p.display_name);
    setShowResults(false);
    setQuery(p.name);
    setError(null);
  }, []);

  // 地图初始化与交互（step 0）
  useEffect(() => {
    if (step !== 0) {
      if (miniMapInstRef.current) {
        try {
          miniMapInstRef.current.remove();
        } catch {}
        miniMapInstRef.current = null;
        miniLeafletRef.current = null;
        miniMarkersRef.current = [];
      }
      if (flyTimerRef.current) window.clearTimeout(flyTimerRef.current);
      return;
    }
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      miniLeafletRef.current = L;
      if (!miniMapRef.current) return;
      if (miniMapInstRef.current) {
        setTimeout(() => miniMapInstRef.current?.invalidateSize(), 180);
        return;
      }
      const initCenter: [number, number] = place ? [Number(place.lat), Number(place.lon)] : [22.2819, 114.158];
      const map = L.map(miniMapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(initCenter, place ? 15 : 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // 拖动中心选点：用 isFlyingRef 屏蔽程序飞行的 moveend
      let moveTimer: number | null = null;
      map.on("moveend", () => {
        if (isFlyingRef.current) return;
        if (moveTimer) window.clearTimeout(moveTimer);
        moveTimer = window.setTimeout(async () => {
          if (isFlyingRef.current) return;
          const c = map.getCenter();
          // 忽略微小抖动
          const cur = placeRef.current;
          if (cur) {
            const dLat = Math.abs(Number(cur.lat) - c.lat);
            const dLng = Math.abs(Number(cur.lon) - c.lng);
            if (dLat < 0.00012 && dLng < 0.00012) return;
          }
          try {
            const res = await fetch(`/api/v1/places/reverse?lat=${c.lat}&lng=${c.lng}`);
            const json = (await res.json()) as { display_name?: string; source?: string };
            const p: Place = {
              place_id: `rev-${c.lat.toFixed(5)}-${c.lng.toFixed(5)}`,
              display_name: json.display_name ?? `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
              name: json.display_name?.split(",")[0] ?? `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
              address: json.display_name ?? "",
              lat: String(c.lat),
              lon: String(c.lng),
              category: "map-pick",
              source: (json.source as string) ?? "nominatim",
            };
            setPlace(p);
            setPlaceEdit(p.display_name);
          } catch {}
        }, 550);
      });

      map.on("click", async (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        // 点击直接当选点，避免额外飞
        try {
          const res = await fetch(`/api/v1/places/reverse?lat=${lat}&lng=${lng}`);
          const json = (await res.json()) as { display_name?: string; source?: string };
          const p: Place = {
            place_id: `rev-${lat.toFixed(5)}-${lng.toFixed(5)}`,
            display_name: json.display_name ?? `${lat.toFixed(5)},${lng.toFixed(5)}`,
            name: json.display_name?.split(",")[0] ?? `${lat.toFixed(5)},${lng.toFixed(5)}`,
            address: json.display_name ?? "",
            lat: String(lat),
            lon: String(lng),
            category: "map-pick",
            source: (json.source as string) ?? "nominatim",
          };
          // 点击选点不触发 moveend 逆向的二次 set
          isFlyingRef.current = true;
          if (flyTimerRef.current) window.clearTimeout(flyTimerRef.current);
          flyTimerRef.current = window.setTimeout(() => (isFlyingRef.current = false), 700) as unknown as number;
          setPlace(p);
          setPlaceEdit(p.display_name);
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
          setPlaceEdit(p.display_name);
        }
      });

      miniMapInstRef.current = map;
      setTimeout(() => map.invalidateSize(), 180);
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  // 结果点仅渲染，不自动飞（避免搜索后与 pin 轮回跳转）
  useEffect(() => {
    const L = miniLeafletRef.current;
    const map = miniMapInstRef.current;
    if (!L || !map) return;
    for (const mm of miniMarkersRef.current) map.removeLayer(mm);
    miniMarkersRef.current = [];
    for (const r of results) {
      const mm = L.marker([Number(r.lat), Number(r.lon)], { title: r.name }).addTo(map);
      mm.on("click", () => selectPlace(r));
      miniMarkersRef.current.push(mm);
    }
  }, [results, selectPlace]);

  // 选中地点 -> 单一飞行入口（带飞行锁，结束后才允许 moveend 逆向）
  useEffect(() => {
    const L = miniLeafletRef.current;
    const map = miniMapInstRef.current;
    if (!L || !map || !place) return;
    isFlyingRef.current = true;
    if (flyTimerRef.current) window.clearTimeout(flyTimerRef.current);
    map.flyTo([Number(place.lat), Number(place.lon)], 16, { duration: 0.55 });
    // 清理旧结果点的高亮，保留主 Pin 由 center-icon 表示（无需额外 marker，避免重复）
    flyTimerRef.current = window.setTimeout(() => {
      isFlyingRef.current = false;
    }, 800) as unknown as number;
  }, [place]);

  // 同步可编辑文本（选中时带入可编辑框，改为 callback 避免 setState-in-effect）
  useEffect(() => {
    if (place) {
      const v = place.display_name;
      queueMicrotask(() => setPlaceEdit(v));
    }
  }, [place?.place_id]);

  function validateCurrent(): string | null {
    if (step === 0) {
      if (!place) return "请先选择地点（搜索或拖动地图）";
      if (!place.display_name.trim()) return "地点名称不能为空";
    }
    if (step === 1) {
      if (title.trim().length < 2) return "标题需 2–30 字";
      if (description.trim().length < 10) return "简介需 10–200 字";
      if (!startsAt) return "请选择时间";
      if (!place) return "请返回上一步选择地点";
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
    setStep(1);
    // 进入信息页时滚动顶部
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
  function prev() {
    setError(null);
    setStep(0);
  }

  function submit() {
    setError(null);
    // 若用户编辑了地址文本，以编辑版为准
    const locText = placeEdit.trim() || place?.display_name || "";
    const iso = startsAt ? new Date(startsAt).toISOString() : "";
    const input = {
      title,
      theme,
      description,
      location_text: locText,
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
      const f = errs[0]!.field;
      if (f === "location") setStep(0);
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

  const handleUseCenter = async () => {
    const map = miniMapInstRef.current;
    if (!map) return;
    const c = map.getCenter();
    try {
      const res = await fetch(`/api/v1/places/reverse?lat=${c.lat}&lng=${c.lng}`);
      const json = (await res.json()) as { display_name?: string; source?: string };
      const p: Place = {
        place_id: `rev-${c.lat.toFixed(5)}-${c.lng.toFixed(5)}`,
        display_name: json.display_name ?? `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
        name: json.display_name?.split(",")[0] ?? `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
        address: json.display_name ?? "",
        lat: String(c.lat),
        lon: String(c.lng),
        category: "map-pick",
        source: (json.source as string) ?? "nominatim",
      };
      setPlace(p);
      setPlaceEdit(p.display_name);
    } catch {}
  };

  return (
    <div className={`${styles.v2scope} fixed inset-0 isolate z-[1000] flex h-dvh flex-col overflow-hidden bg-background text-foreground`}>
      <header className="flex shrink-0 items-center gap-2 border-b bg-card px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="back" onClick={() => router.back()} type="button">
          <ChevronLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight">{t("newTitle")}</h1>
          <p className="truncate text-xs text-muted-foreground">先选地点再填信息 · 平台仅撮合</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[640px] p-3 md:p-6">
          {/* Step tracker - 手机更紧凑 */}
          <div className="mb-4">
            <div className="flex items-center gap-2">
              {STEPS.map((s, idx) => {
                const active = idx === step;
                const done = idx < step;
                return (
                  <div key={s.key} className="flex flex-1 items-center gap-2">
                    <div
                      className={`flex size-7 items-center justify-center rounded-full border text-xs font-medium transition-colors md:size-8 md:text-sm ${
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="size-3.5" /> : idx + 1}
                    </div>
                    <span className={`text-xs font-medium md:text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                    {idx < STEPS.length - 1 && <div className={`mx-1 h-px flex-1 md:mx-2 ${idx < step ? "bg-primary" : "bg-border"}`} />}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>

          {/* STEP 0: 地点优先 */}
          {step === 0 && (
            <div className="space-y-3">
              {/* 搜索框 + 即时下拉 */}
              <div ref={searchWrapRef} className="relative">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (e.target.value.trim()) setShowResults(true);
                    }}
                    onFocus={() => {
                      if (results.length > 0) setShowResults(true);
                    }}
                    onBlur={handleBlur}
                    placeholder="搜索地点，如 中环、奥海城、奥运、Central…"
                    className="h-11 rounded-xl bg-card pl-10 pr-10 text-[15px] shadow-sm"
                    autoComplete="off"
                  />
                  <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    {query ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-full"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setQuery("");
                          setResults([]);
                          setShowResults(false);
                          searchInputRef.current?.focus();
                        }}
                        type="button"
                        aria-label="clear"
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                    {searching ? <Loader2 className="mr-1 size-4 animate-spin text-muted-foreground" /> : null}
                  </div>
                </div>

                {/* 即时结果下拉 - fixed 逃离 stacking/overflow，确保盖过地图瓦片与 Pin */}
                {showResults && (query.trim().length > 0 || results.length > 0) && (
                  <div
                    className="fixed z-[9999] max-h-[42vh] overflow-auto rounded-xl border bg-card p-1.5 shadow-xl"
                    style={
                      dropdownPos
                        ? { left: dropdownPos.left, top: dropdownPos.top, width: dropdownPos.width }
                        : { left: 12, right: 12 }
                    }
                  >
                    {results.length > 0 ? (
                      <div className="space-y-1">
                        {results.map((r) => (
                          <button
                            key={`${r.source}-${r.place_id}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectPlace(r)}
                            className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${place?.place_id === r.place_id ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"}`}
                          >
                            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px]">{r.source === "amap" ? "高" : "OS"}</span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-1 text-sm font-medium">{r.name}</span>
                              <span className="line-clamp-1 text-xs text-muted-foreground">{r.address || r.display_name}</span>
                            </span>
                            <Badge variant="outline" className="mt-1 shrink-0 text-[10px]">
                              {r.category || "地点"}
                            </Badge>
                          </button>
                        ))}
                        <p className="px-2 py-1 text-center text-[11px] text-muted-foreground">点选可定位到地图 · 支持中英文及近似拼写</p>
                      </div>
                    ) : searching ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> 搜索中…
                      </div>
                    ) : (
                      <div className="px-3 py-5 text-center">
                        <p className="text-sm text-muted-foreground">暂无匹配</p>
                        <p className="mt-1 text-xs text-muted-foreground">试试更换关键词或直接拖动地图选点</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 地图 */}
              <div className="relative h-[380px] w-full shrink-0 overflow-hidden rounded-2xl border bg-muted shadow-sm md:h-[420px]">
                <div ref={miniMapRef} className="absolute inset-0" />
                {/* 中心 Pin（需高于 Leaflet 瓦片 200，但低于搜索下拉 1000） */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-[30px]">
                  <div className="flex flex-col items-center">
                    <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-2 ring-white">
                      <MapPin className="size-5" />
                    </div>
                    <div className="h-2 w-1 rounded-full bg-foreground/30" />
                    <div className="mt-1 size-3 rounded-full bg-primary/40 blur-[2px]" />
                  </div>
                </div>
                <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow">
                  拖动或点击地图选点
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2 h-8 gap-1 rounded-full bg-card shadow"
                  onClick={handleUseCenter}
                  type="button"
                >
                  <LocateFixed className="size-3.5" /> 选定中心
                </Button>
              </div>

              {/* 选中结果输出 + 可编辑 */}
              {place ? (
                <Card className="border-primary/30 bg-card shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <MapPin className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold">已选地点</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {place.source === "amap" ? "高德" : "OSM"} · {place.category || "POI"}
                          </Badge>
                          <Badge variant="outline" className="ml-auto font-mono text-[10px]">
                            {Number(place.lat).toFixed(5)}, {Number(place.lon).toFixed(5)}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Edit3 className="size-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">可编辑，支持重新搜索</span>
                        </div>
                        <Input
                          value={placeEdit}
                          onChange={(e) => setPlaceEdit(e.target.value)}
                          placeholder="地址显示名"
                          className="mt-1.5 h-9 bg-background text-sm"
                        />
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{place.address || place.display_name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-3 text-center text-sm text-muted-foreground">
                  搜索或拖动地图选择地点（不支持手输空白，需选 POI/坐标）
                </div>
              )}

              {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

              <div className="flex gap-2 pt-1">
                <Button variant="ghost" onClick={() => router.back()} type="button" className="flex-1">
                  取消
                </Button>
                <Button onClick={next} type="button" disabled={!place} className="flex-1 gap-1 rounded-xl">
                  下一步 <ChevronRight className="size-4" />
                </Button>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">地点由高德/Nominatim 驱动，支持中英文与近似关键词</p>
            </div>
          )}

          {/* STEP 1: 精简信息（同页） */}
          {step === 1 && (
            <div className="space-y-4">
              {/* 已选地点摘要 */}
              {place && (
                <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <MapPin className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{placeEdit || place.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number(place.lat).toFixed(5)}, {Number(place.lon).toFixed(5)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={prev} type="button" className="shrink-0">
                    更换
                  </Button>
                </div>
              )}

              <Card className="border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px]">活动信息</CardTitle>
                  <CardDescription className="text-xs">标题、主题与简介（精简）</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="title" className="text-sm">
                      标题 <span className="text-destructive">*</span>
                    </Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：周末中环微醺小聚" maxLength={30} className="h-10 rounded-xl" />
                    <p className="text-right text-[11px] text-muted-foreground">{title.length}/30</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">
                      主题 <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {Object.entries(THEME_META).map(([k, m]) => {
                        const active = theme === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setTheme(k as GatheringTheme)}
                            className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card hover:bg-muted"}`}
                          >
                            <span className="text-base leading-none">{m.icon}</span>
                            <span className="mt-1 block text-xs font-medium leading-tight">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="desc" className="text-sm">
                      简介 <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="一句话说明玩法与氛围，10–200字"
                      maxLength={200}
                      rows={3}
                      className="min-h-[84px] resize-none rounded-xl"
                    />
                    <p className="text-right text-[11px] text-muted-foreground">{description.length}/200</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-[15px]">
                    <Calendar className="size-4" /> 时间与人数
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="time" className="text-sm">
                      时间 <span className="text-destructive">*</span>
                    </Label>
                    <Input id="time" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-10 rounded-xl" />
                    <p className="text-xs text-muted-foreground">需 2 小时后至 14 天内</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1 text-sm">
                      <Users className="size-4" /> 人数 <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="size-9 rounded-xl" onClick={() => setCapacity((c) => Math.max(2, c - 1))} type="button" aria-label="minus">
                        −
                      </Button>
                      <div className="flex-1 rounded-xl border bg-card px-3 py-2 text-center text-sm font-medium">{capacity} 人（含发起人）</div>
                      <Button variant="outline" size="icon" className="size-9 rounded-xl" onClick={() => setCapacity((c) => Math.min(8, c + 1))} type="button" aria-label="plus">
                        +
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">2–8 人</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px]">偏好与补充</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">可见性</Label>
                      <div className="flex gap-1.5">
                        <Button type="button" variant={visibility === "public" ? "default" : "outline"} size="sm" className="flex-1 rounded-xl" onClick={() => setVisibility("public")}>
                          公开
                        </Button>
                        <Button type="button" variant={visibility === "friends" ? "default" : "outline"} size="sm" className="flex-1 rounded-xl" onClick={() => setVisibility("friends")}>
                          仅好友
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">审批</Label>
                      <div className="flex gap-1.5">
                        <Button type="button" variant={approval === "manual" ? "default" : "outline"} size="sm" className="flex-1 rounded-xl" onClick={() => setApproval("manual")}>
                          需审批
                        </Button>
                        <Button type="button" variant={approval === "auto" ? "default" : "outline"} size="sm" className="flex-1 rounded-xl" onClick={() => setApproval("auto")}>
                          自动
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bring" className="text-xs">
                      带的酒/食物（选填）
                    </Label>
                    <Input id="bring" value={bring} onChange={(e) => setBring(e.target.value)} placeholder="如：白葡萄酒 / 小食" maxLength={30} className="h-9 rounded-xl" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-[15px]">
                    <ShieldCheck className="size-4" /> 年龄与免责 <span className="text-destructive">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button variant={ageMinor === false ? "default" : "outline"} size="sm" onClick={() => setAgeMinor(false)} type="button" className="flex-1 rounded-xl">
                      <Check className="mr-1 size-4" /> 皆成人
                    </Button>
                    <Button variant={ageMinor === true ? "destructive" : "outline"} size="sm" onClick={() => setAgeMinor(true)} type="button" className="flex-1 rounded-xl">
                      有未成年
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">有未成年人一票否决（五项审查）</p>
                  <Separator />
                  <label className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                    <span>我已阅读并同意免责声明（平台仅撮合，不指定场地）</span>
                  </label>
                  {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" onClick={prev} type="button" className="flex-1 rounded-xl">
                      <ChevronLeft className="mr-1 size-4" /> 上一步
                    </Button>
                    <Button onClick={submit} disabled={pending} type="button" className="flex-1 rounded-xl">
                      {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {pending ? t("submitting") : t("submit")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

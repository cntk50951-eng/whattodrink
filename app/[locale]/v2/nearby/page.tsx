"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, MapPin, Navigation, Phone, Search, X } from "lucide-react";
import type * as Leaflet from "leaflet";

import { Button } from "@/components/ui/button";
import { DEFAULT_CENTER, formatDistance, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { parseMapProvider, tileSpecFor } from "@/lib/maps/provider";
import { useGeolocation } from "@/hooks/useGeolocation";

type NearbyKind = "bar" | "store";

type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  tel: string | null;
  lat: number;
  lng: number;
  distance_m: number | null;
  kind: NearbyKind;
};

function asPlace(r: unknown, kind: NearbyKind): NearbyPlace | null {
  if (typeof r !== "object" || r === null) return null;
  const rec = r as Record<string, unknown>;
  if (typeof rec.id !== "string" || typeof rec.name !== "string") return null;
  if (typeof rec.lat !== "number" || typeof rec.lng !== "number") return null;
  if (!Number.isFinite(rec.lat) || !Number.isFinite(rec.lng)) return null;
  return {
    id: rec.id,
    name: rec.name,
    address: typeof rec.address === "string" ? rec.address : "",
    tel: typeof rec.tel === "string" && rec.tel !== "" ? rec.tel : null,
    lat: rec.lat,
    lng: rec.lng,
    distance_m: typeof rec.distance_m === "number" ? rec.distance_m : null,
    kind,
  };
}

function dotIcon(L: typeof import("leaflet"), color: string): Leaflet.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/**
 * UR G.4 附近酒吧（v2-only；对标 iOS NearbyBars：3km POI＋双色钉＋peek 卡＋外跳导航）。
 * 数据沿 GET /places/around（服务端高德代理，GCJ 已转 WGS；空即扩 5000；
 * 无 Key 503 即提示配 key）。站内步行导航二期，只做外跳（Apple／Google）＋tel:。
 */
export default function NearbyPage(): React.ReactElement {
  const t = useTranslations("v2");
  const locale = useLocale();
  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const pinsRef = useRef<Leaflet.LayerGroup | null>(null);
  const selfRef = useRef<Leaflet.CircleMarker | null>(null);
  const { position, status: geoStatus, retry } = useGeolocation();
  const [kinds, setKinds] = useState<NearbyKind[]>(["bar", "store"]);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [Lmod, setLmod] = useState<typeof import("leaflet") | null>(null);

  const fetchAround = useCallback(async (center: LatLng, ks: NearbyKind[]) => {
    setLoading(true);
    setFailed(null);
    try {
      const out: NearbyPlace[] = [];
      for (const k of ks) {
        const res = await fetch(
          `/api/v1/places/around?lat=${center.lat}&lng=${center.lng}&radius=3000&kind=${k}`,
          { credentials: "include" },
        );
        if (res.status === 503) throw new Error("nokey");
        if (!res.ok) throw new Error(`around ${res.status}`);
        const j = (await res.json()) as { places?: unknown[] };
        for (const r of Array.isArray(j.places) ? j.places : []) {
          const m = asPlace(r, k);
          if (m !== null && !out.some((o) => o.id === m.id)) out.push(m);
        }
      }
      out.sort((a, b) => (a.distance_m ?? 1e12) - (b.distance_m ?? 1e12));
      setPlaces(out);
    } catch (e) {
      setFailed(e instanceof Error && e.message === "nokey" ? "nokey" : "bad");
    } finally {
      setLoading(false);
    }
  }, []);

  // 地图 init（imperative Leaflet＋provider 瓦片，沿 V2MapView 口径）。
  useEffect(() => {
    if (holderRef.current === null) return;
    let map: Leaflet.Map | null = null;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || holderRef.current === null) return;
      setLmod(L);
      const spec = tileSpecFor(parseMapProvider(process.env.NEXT_PUBLIC_MAP_PROVIDER));
      map = L.map(holderRef.current as HTMLElement, {
        zoomControl: false,
        minZoom: ZOOM_MIN,
        maxZoom: ZOOM_MAX,
      }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], ZOOM_DEFAULT);
      L.tileLayer(spec.url, {
        attribution: spec.attribution,
        maxNativeZoom: spec.maxNativeZoom,
      }).addTo(map);
      pinsRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      map.on("moveend", () => setDirty(true));
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // 有定位即飞人＋首拉（沿首页 fly-to-me 口径）。
  const flownRef = useRef(false);
  useEffect(() => {
    if (position === null || mapRef.current === null || Lmod === null) return;
    const map = mapRef.current;
    if (selfRef.current === null) {
      selfRef.current = Lmod.circleMarker([position.lat, position.lng], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(map);
    } else {
      selfRef.current.setLatLng([position.lat, position.lng]);
    }
    if (!flownRef.current) {
      flownRef.current = true;
      map.setView([position.lat, position.lng], 15);
      setDirty(false);
      void fetchAround(position, kinds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 首定位单次（沿 live-follow 首 fix 口径）
  }, [position, Lmod]);

  // 钉层重绘（双色：酒吧琥珀／便利店天蓝，沿 iOS 口径）。
  useEffect(() => {
    const layer = pinsRef.current;
    if (layer === null || Lmod === null) return;
    layer.clearLayers();
    for (const p of places) {
      const m = Lmod.marker([p.lat, p.lng], {
        icon: dotIcon(Lmod, p.kind === "bar" ? "#f59e0b" : "#38bdf8"),
      });
      m.on("click", () => setPeekId(p.id));
      m.addTo(layer);
    }
  }, [places, Lmod]);

  function research(): void {
    const map = mapRef.current;
    if (map === null) return;
    const c = map.getCenter();
    setDirty(false);
    setPeekId(null);
    void fetchAround({ lat: c.lat, lng: c.lng }, kinds);
  }

  const peek = places.find((p) => p.id === peekId) ?? null;

  return (
    <main className="relative h-[100svh] w-full overflow-hidden">
      <div ref={holderRef} className="absolute inset-0 z-0" />
      <div className="absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/v2`}
            aria-label={t("cancel")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card shadow-md"
          >
            <ChevronLeft aria-hidden />
          </Link>
          <h1 className="text-base font-bold">{t("nearbyTitle")}</h1>
        </div>
        <div className="flex gap-2">
          {(["bar", "store"] as NearbyKind[]).map((k) => {
            const on = kinds.includes(k);
            return (
              <Button
                key={k}
                size="sm"
                variant={on ? "secondary" : "outline"}
                className="shrink-0 rounded-full bg-card shadow-md"
                aria-pressed={on}
                onClick={() => {
                  const next =
                    kinds.includes(k)
                      ? kinds.length === 1
                        ? kinds
                        : kinds.filter((x) => x !== k)
                      : [...kinds, k];
                  if (next !== kinds) {
                    setKinds(next);
                    const map = mapRef.current;
                    const center =
                      map !== null
                        ? { lat: map.getCenter().lat, lng: map.getCenter().lng }
                        : position;
                    setPeekId(null);
                    if (center !== null) void fetchAround(center, next);
                  }
                }}
              >
                {k === "bar" ? t("nearbyBar") : t("nearbyStore")}
              </Button>
            );
          })}
          <span className="flex-1" />
          {dirty && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 rounded-full bg-card shadow-md"
              onClick={research}
            >
              <Search size={14} aria-hidden />
              {t("nearbySearchArea")}
            </Button>
          )}
        </div>
      </div>

      {geoStatus === "denied" && (
        <div className="absolute inset-x-3 top-28 z-[1000] rounded-2xl border bg-card p-3 text-sm shadow-lg">
          <p>{t("nearbyNeedPos")}</p>
          <Button size="sm" className="mt-2" onClick={retry}>
            {t("newsRetry")}
          </Button>
        </div>
      )}
      {loading && (
        <p role="status" className="absolute left-1/2 top-28 z-[1000] -translate-x-1/2 rounded-full bg-foreground px-4 py-1.5 text-sm text-background">
          …
        </p>
      )}
      {failed !== null && (
        <div className="absolute inset-x-3 top-28 z-[1000] rounded-2xl border bg-card p-3 text-sm shadow-lg">
          <p>{failed === "nokey" ? t("nearbyNoKey") : t("partyFailed")}</p>
        </div>
      )}
      {places.length === 0 && failed === null && !loading && (
        <p className="absolute inset-x-3 top-28 z-[1000] rounded-2xl border bg-card p-3 text-center text-sm text-muted-foreground shadow-lg">
          {t("nearbyEmpty")}
        </p>
      )}

      {peek !== null && (
        <div className="absolute inset-x-3 bottom-6 z-[1000] rounded-2xl border bg-card p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <MapPin size={18} aria-hidden className="mt-0.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{peek.name}</p>
              {peek.address !== "" && (
                <p className="truncate text-xs text-muted-foreground">{peek.address}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {peek.distance_m !== null ? formatDistance(peek.distance_m) : ""}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("cancel")}
              className="shrink-0 rounded-full p-1 text-muted-foreground"
              onClick={() => setPeekId(null)}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            <a
              className="flex flex-1 items-center justify-center gap-1 rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
              href={`https://www.google.com/maps/dir/?api=1&destination=${peek.lat},${peek.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={14} aria-hidden />
              Google
            </a>
            <a
              className="flex flex-1 items-center justify-center gap-1 rounded-full border px-3 py-2 text-sm font-bold"
              href={`https://maps.apple.com/?daddr=${peek.lat},${peek.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={14} aria-hidden />
              Apple
            </a>
            {peek.tel !== null && (
              <a
                className="flex items-center justify-center gap-1 rounded-full border px-3 py-2 text-sm font-bold"
                href={`tel:${peek.tel.replace(/\s+/g, "")}`}
              >
                <Phone size={14} aria-hidden />
                {t("nearbyCall")}
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

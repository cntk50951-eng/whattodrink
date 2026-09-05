"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { useTranslations } from "next-intl";
import { Dices, Expand, Minus, Plus, X } from "lucide-react";

import { useGeolocation } from "@/hooks/useGeolocation";
import { MOCK_CHECKINS } from "@/lib/checkins";
import type { Checkin } from "@/lib/checkins";
import { pickRandomBeer } from "@/lib/beers";
import type { Beer } from "@/lib/beers";
import type { LatLng } from "@/lib/geo";
import {
  DEFAULT_CENTER,
  ESRI_ATTRIBUTION,
  ESRI_URL,
  HK_BOUNDS,
  STADIA_ATTRIBUTION,
  STADIA_MAX_NATIVE_ZOOM,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  isWithinHongKong,
  stadiaTileUrl,
} from "@/lib/geo";
import { BeerMugDoodle } from "@/components/marketing/BeerMugDoodle";
import styles from "./drink-map.module.css";

/**
 * UR1.1 homepage drink map — map + drink-pick entry as ONE component.
 *
 * - Geolocation via useGeolocation; denied/failed → Hong Kong-wide view.
 * - Base tiles: free CARTO Voyager (no key), re-skinned toward paper tone
 *   with a CSS filter + doodle pins/frame so it never reads as Google Maps.
 * - Other users are MOCK_CHECKINS seed data (clearly badged in UI).
 *   EPIC 3 replaces them with the Supabase backend — markers read from
 *   state, so only the data source needs swapping.
 * - The floating pick panel is the user-journey entry (backlog flow 1→2):
 *   random pick → 「想喝」 pin drops on the map (local preview for now).
 *
 * Leaflet loads via dynamic import() inside the effect, so this component
 * is SSR-safe without needing next/dynamic ssr:false.
 */

/** Sentinel selection id for the user's own marker (no backend row). */
const SELF_ID = "self";
export function DrinkMap() {
  const t = useTranslations("map");
  const heroT = useTranslations("hero");
  const { status: geoStatus, position: geoPosition } = useGeolocation();

  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const selfMarkerRef = useRef<Leaflet.Marker | null>(null);
  const wantLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const settledRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [picked, setPicked] = useState<Beer | null>(null);
  const [wantAt, setWantAt] = useState<LatLng | null>(null);
  const [wantSaved, setWantSaved] = useState(false);

  const isSelf = selectedId === SELF_ID;
  /** Bottom card content: own marker, a mock check-in, or nothing. */
  const card: "self" | Checkin | null = isSelf
    ? "self"
    : (MOCK_CHECKINS.find((c) => c.id === selectedId) ?? null);
  const geoFailed =
    geoStatus === "denied" ||
    geoStatus === "unavailable" ||
    geoStatus === "timeout" ||
    geoStatus === "unsupported";
  const outsideHk =
    geoStatus === "success" && geoPosition !== null
      ? !isWithinHongKong(geoPosition)
      : false;

  /* ---- init Leaflet once ---- */
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;

    async function init(): Promise<void> {
      const holder = holderRef.current;
      if (holder === null || holder.dataset.ready === "1") return;
      const L = await import("leaflet");
      if (cancelled) return;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      map = L.map(holder, {
        zoomControl: false,
        minZoom: ZOOM_MIN,
        maxZoom: ZOOM_MAX,
        zoomAnimation: !reduced,
        fadeAnimation: !reduced,
      });
      // Stadia watercolor when the public key is configured, otherwise the
      // keyless Esri fallback — the map never renders empty while waiting
      // for the key. maxNativeZoom lets Leaflet over-zoom past z16 tiles.
      const stadiaKey = (process.env.NEXT_PUBLIC_STADIA_KEY ?? "").trim();
      const useStadia = stadiaKey.length > 0;
      L.tileLayer(useStadia ? stadiaTileUrl(stadiaKey) : ESRI_URL, {
        attribution: useStadia ? STADIA_ATTRIBUTION : ESRI_ATTRIBUTION,
        maxZoom: ZOOM_MAX,
        maxNativeZoom: STADIA_MAX_NATIVE_ZOOM,
      }).addTo(map);
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], ZOOM_DEFAULT);
      for (const [i, c] of MOCK_CHECKINS.entries()) {
        const pinClass =
          i % 2 === 0 ? styles.pin : `${styles.pin} ${styles.pinAlt}`;
        const marker = L.marker([c.position.lat, c.position.lng], {
          title: c.nickname,
          icon: L.divIcon({
            className: "",
            html: `<div class="${pinClass}">${c.drinkEmoji}</div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 38],
          }),
        });
        marker.on("click", () => setSelectedId(c.id));
        marker.addTo(map);
      }
      holder.dataset.ready = "1";
      mapRef.current = map;
      leafletRef.current = L;
      setMapReady(true);
    }

    void init();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      selfMarkerRef.current = null;
      wantLayerRef.current = null;
    };
  }, []);

  /* ---- settle the initial view once geo resolves (or fails) ---- */
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || map === null || L === null || settledRef.current) return;

    const fitHk = (): void => {
      map.fitBounds(
        [
          [HK_BOUNDS.south, HK_BOUNDS.west],
          [HK_BOUNDS.north, HK_BOUNDS.east],
        ],
        { padding: [24, 24] },
      );
    };

    if (geoStatus === "success" && geoPosition !== null) {
      settledRef.current = true;
      if (isWithinHongKong(geoPosition)) {
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (reduced) {
          map.setView([geoPosition.lat, geoPosition.lng], 15);
        } else {
          map.flyTo([geoPosition.lat, geoPosition.lng], 15, {
            duration: 1.2,
          });
        }
        selfMarkerRef.current = L.marker(
          [geoPosition.lat, geoPosition.lng],
          {
            title: t("you"),
            icon: L.divIcon({
              className: "",
              html: `<div class="${styles.pinSelf}">${t("you")}</div>`,
              iconSize: [40, 40],
              iconAnchor: [20, 38],
            }),
          },
        );
        selfMarkerRef.current.on("click", () => setSelectedId(SELF_ID));
        selfMarkerRef.current.addTo(map);
      } else {
        fitHk();
      }
    } else if (geoFailed) {
      settledRef.current = true;
      fitHk();
    }
  }, [mapReady, geoStatus, geoPosition, geoFailed, t]);

  /* ---- 「想喝」 pin layer ---- */
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || map === null || L === null) return;
    wantLayerRef.current?.remove();
    wantLayerRef.current = null;
    if (wantAt === null || picked === null) return;

    const ink =
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--doodle-red")
        .trim() || "#b3261e";
    const layer = L.layerGroup([
      L.circle([wantAt.lat, wantAt.lng], {
        radius: 350,
        color: ink,
        weight: 2.5,
        dashArray: "8 6",
        fillColor: ink,
        fillOpacity: 0.08,
      }),
      L.marker([wantAt.lat, wantAt.lng], {
        title: picked.name,
        icon: L.divIcon({
          className: "",
          html: `<div class="${styles.pinWant}">${picked.emoji}</div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 44],
        }),
      }),
    ]);
    layer.addTo(map);
    wantLayerRef.current = layer;
    map.setView([wantAt.lat, wantAt.lng], Math.max(map.getZoom(), 14));
  }, [mapReady, wantAt, picked]);

  function handlePick(): void {
    setPicked(pickRandomBeer());
    setWantAt(null);
    setWantSaved(false);
  }

  function handleWant(): void {
    const map = mapRef.current;
    if (picked === null) return;
    // Prefer the real position; otherwise drop the pin at the map centre.
    const at =
      geoStatus === "success" &&
      geoPosition !== null &&
      isWithinHongKong(geoPosition)
        ? geoPosition
        : map !== null
          ? { lat: map.getCenter().lat, lng: map.getCenter().lng }
          : DEFAULT_CENTER;
    setWantAt(at);
    setWantSaved(true);
  }

  function handleSelfPick(): void {
    // From your own pin: close the card and run the journey entry —
    // the result lands in the pick panel (now visible above the tiles).
    setSelectedId(null);
    handlePick();
  }

  function handleCheers(id: string): void {
    // MOCK — local state only. EPIC 3 sends a real cheers via Supabase.
    setSentIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function handleZoom(delta: number): void {
    if (delta > 0) mapRef.current?.zoomIn();
    else mapRef.current?.zoomOut();
  }

  function handleFitHk(): void {
    mapRef.current?.fitBounds(
      [
        [HK_BOUNDS.south, HK_BOUNDS.west],
        [HK_BOUNDS.north, HK_BOUNDS.east],
      ],
      { padding: [24, 24] },
    );
  }

  return (
    <div
      className={`${styles.frame} relative overflow-hidden rounded-2xl border-2 bg-card shadow-[4px_4px_0_var(--border)]`}
    >
      <div
        ref={holderRef}
        className="h-[420px] w-full md:h-[560px]"
        role="application"
        aria-label={t("mapLabel")}
      />

      {/* Notebook dot-grid over the tiles */}
      <div aria-hidden className={styles.paper} />

      {/* Pick entry overlay — journey step 1, same component as the map */}
      <div
        className={`${styles.above} absolute top-3 left-3 max-w-[240px] rounded-2xl border-2 bg-card/95 p-4 shadow-[3px_3px_0_var(--border)] backdrop-blur-sm md:max-w-xs`}
      >
        <span
          aria-hidden
          className="absolute -top-3 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-4 rounded-[2px] bg-[var(--tape)] opacity-90"
        />
        <p className="font-hand text-xl leading-none font-bold md:text-2xl">
          {t("pickTitle")}
        </p>
        {picked === null ? (
          <button
            type="button"
            onClick={handlePick}
            className="font-hand mt-3 inline-flex items-center gap-2 rounded-full border-2 bg-primary px-4 py-2 text-base font-bold text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <Dices size={18} aria-hidden />
            {t("pickCta")}
          </button>
        ) : (
          <div className="mt-3">
            <p className="text-3xl" aria-hidden>
              {picked.emoji}
            </p>
            <p className="mt-1 font-bold">{picked.name}</p>
            <p className="text-muted-foreground text-sm">{picked.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleWant}
                className="font-hand inline-flex items-center gap-1.5 rounded-full border-2 bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <Plus size={15} aria-hidden />
                {t("wantToDrink")}
              </button>
              <button
                type="button"
                onClick={handlePick}
                className="rounded-full border-2 px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                {t("pickAgain")}
              </button>
            </div>
            {wantSaved && (
              <p className="text-muted-foreground mt-2 text-xs">
                {t("wantSaved")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Beer doodle — brand corner decoration */}
      <div
        aria-hidden
        className={`${styles.above} pointer-events-none absolute top-2 right-2 w-16 rotate-6 md:w-24`}
      >
        <BeerMugDoodle cheersLabel={heroT("cheers")} />
      </div>

      {/* Doodle compass — decorative sticker under the beer */}
      <div
        aria-hidden
        className={`${styles.above} pointer-events-none absolute top-24 right-4 hidden rotate-12 sm:block md:top-32`}
      >
        <svg viewBox="0 0 48 48" width="44" height="44">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="var(--card)"
            stroke="var(--border)"
            strokeWidth="2.5"
          />
          <text
            x="24"
            y="13"
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="var(--doodle-red)"
            className="font-hand"
          >
            N
          </text>
          <polygon
            points="24,16 27.5,28 24,26 20.5,28"
            fill="var(--doodle-red)"
            stroke="var(--border)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <polygon
            points="24,40 27.5,28 24,30 20.5,28"
            fill="var(--card)"
            stroke="var(--border)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Custom zoom controls (doodle pills, not Leaflet defaults) */}
      <div
        className={`${styles.above} absolute right-3 bottom-14 flex flex-col gap-2 md:bottom-16`}
      >
        <button
          type="button"
          onClick={() => handleZoom(1)}
          aria-label={t("zoomIn")}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <Plus size={18} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => handleZoom(-1)}
          aria-label={t("zoomOut")}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <Minus size={18} aria-hidden />
        </button>
        <button
          type="button"
          onClick={handleFitHk}
          aria-label={t("hkWide")}
          title={t("hkWide")}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <Expand size={18} aria-hidden />
        </button>
      </div>

      {/* MOCK badge — always visible while seed data is on the map */}
      <p
        className={`${styles.above} absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border-2 bg-card/95 px-3 py-1 text-xs font-bold`}
      >
        <span aria-hidden className={styles.liveDot} />
        {t("mockBadge")}
      </p>

      {/* Geo status notice */}
      {(geoStatus === "locating" || geoFailed || outsideHk) && (
        <p
          role="status"
          className={`${styles.above} absolute bottom-3 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full border-2 bg-card/95 px-4 py-1.5 text-center text-xs font-bold md:text-sm`}
        >
          {geoStatus === "locating" && t("locating")}
          {geoFailed && t("denied")}
          {outsideHk && t("outside")}
        </p>
      )}

      {/* Selected pin card — own marker or a mock check-in */}
      {card !== null && (
        <div
          className={`${styles.above} absolute right-3 bottom-3 left-3 rounded-2xl border-2 bg-card/95 p-4 shadow-[3px_3px_0_var(--border)] backdrop-blur-sm md:right-auto md:left-1/2 md:w-80 md:-translate-x-1/2`}
        >
          <span
            aria-hidden
            className="absolute -top-3 left-10 h-5 w-16 rotate-3 rounded-[2px] bg-[var(--tape)] opacity-90"
          />
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label={t("close")}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border-2"
          >
            <X size={16} aria-hidden />
          </button>
          {card === "self" ? (
            <div>
              <p className="font-hand text-2xl leading-none font-bold">
                {t("selfHere")}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                {t("selfHint")}
              </p>
              <button
                type="button"
                onClick={handleSelfPick}
                className="font-hand mt-3 inline-flex items-center gap-1.5 rounded-full border-2 bg-primary px-4 py-1.5 font-bold text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                {t("pickCta")}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 text-2xl"
                  aria-hidden
                >
                  {card.drinkEmoji}
                </span>
                <div>
                  <p className="font-bold">
                    {card.nickname} · {card.area}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {t("drinking", { drink: card.drinkName })}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  {t("cheersCount", { n: card.cheers })}
                </p>
                {sentIds.includes(card.id) ? (
                  <p role="status" className="font-hand text-lg font-bold">
                    {t("cheersSent")}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCheers(card.id)}
                    className="font-hand inline-flex items-center gap-1.5 rounded-full border-2 bg-primary px-4 py-1.5 font-bold text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    {t("cheers")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

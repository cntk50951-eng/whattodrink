"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type * as Leaflet from "leaflet";
import { useTranslations } from "next-intl";
import { Dices, Expand, LocateFixed, Minus, Plus, X } from "lucide-react";

import { useGeolocation } from "@/hooks/useGeolocation";
import {
  ANDROID_LOCATION_SETTINGS_INTENT,
  detectBrowser,
  detectPlatform,
} from "@/lib/device";
import type { DeviceBrowser, DevicePlatform } from "@/lib/device";
import { MOCK_CHECKINS } from "@/lib/checkins";
import type { Checkin } from "@/lib/checkins";
import { pickRandomBeer } from "@/lib/beers";
import type { Beer } from "@/lib/beers";
import type { LatLng } from "@/lib/geo";
import {
  DEFAULT_CENTER,
  HK_BOUNDS,
  OSM_ATTRIBUTION,
  OSM_MAX_NATIVE_ZOOM,
  OSM_URL,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  isWithinHongKong,
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

/** Pixels the camera shifts up so sheet-open content clears the drawer. */
const SHEET_OFFSET_PX = 180;
/** Down-drag distance on the sheet handle that dismisses the sheet. */
const SHEET_DISMISS_DY = 72;
export function DrinkMap() {
  const t = useTranslations("map");
  const heroT = useTranslations("hero");
  const {
    status: geoStatus,
    position: geoPosition,
    retry: retryGeo,
  } = useGeolocation({ watch: true });

  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const selfMarkerRef = useRef<Leaflet.Marker | null>(null);
  const wantLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const settledRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  // UR1.2 bottom sheet: closed pill <-> open half-sheet. Auto-closes into
  // a chip when the 想喝 pin drops so the map is never buried on small screens.
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startY: number; dy: number } | null>(null);

  // Platform for the permission overlay (SSR-safe: "other" on the server).
  const platform = useMemo<DevicePlatform>(
    () =>
      typeof navigator === "undefined"
        ? "other"
        : detectPlatform(navigator.userAgent),
    [],
  );
  const browser = useMemo<DeviceBrowser>(
    () =>
      typeof navigator === "undefined"
        ? "other"
        : detectBrowser(navigator.userAgent),
    [],
  );
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
        // UR1.3 scroll-trap fix: the map is embedded in a scrolling page,
        // not a full map-app — wheel must scroll the page (zoom stays on
        // buttons / double-click), touch verticals go to the page (see the
        // touch-action rule in the CSS module).
        scrollWheelZoom: false,
        minZoom: ZOOM_MIN,
        maxZoom: ZOOM_MAX,
        zoomAnimation: !reduced,
        fadeAnimation: !reduced,
      });
      // OSM standard raster — keyless, no signup. Colourful out of the box;
      // the doodle skin (CSS filter + dot-grid + stickers) pushes it warm.
      L.tileLayer(OSM_URL, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: ZOOM_MAX,
        maxNativeZoom: OSM_MAX_NATIVE_ZOOM,
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

    // Settle gate is one-shot per request round: handleRetryLocate resets it
    // so a grant-after-denial re-settles instead of stranding the map.
    if (geoStatus === "success" && geoPosition !== null) {
      if (isWithinHongKong(geoPosition)) {
        // UR1.2 live dot — textless pulsing marker; created once, moved by
        // the follow effect below, camera untouched after the first settle.
        if (selfMarkerRef.current === null) {
          selfMarkerRef.current = L.marker(
            [geoPosition.lat, geoPosition.lng],
            {
              title: t("you"),
              keyboard: false,
              icon: L.divIcon({
                className: "",
                html: `<div class="${styles.pinLive}"></div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              }),
            },
          );
          selfMarkerRef.current.on("click", () => setSelectedId(SELF_ID));
          selfMarkerRef.current.addTo(map);
        }
        if (!settledRef.current) {
          settledRef.current = true;
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
        }
      } else if (!settledRef.current) {
        settledRef.current = true;
        fitHk();
      }
    } else if (geoFailed && !settledRef.current) {
      settledRef.current = true;
      fitHk();
    }
  }, [mapReady, geoStatus, geoPosition, geoFailed, t]);

  /* ---- UR1.2 live-follow: move the dot, never the camera ---- */
  useEffect(() => {
    const marker = selfMarkerRef.current;
    if (!mapReady || marker === null || geoPosition === null) return;
    // Off-map fixes keep the last on-map dot (frozen, not vanished).
    if (!isWithinHongKong(geoPosition)) return;
    marker.setLatLng([geoPosition.lat, geoPosition.lng]);
  }, [mapReady, geoPosition]);

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

  /**
   * Fly the camera so the target clears the open sheet (shifted up by
   * SHEET_OFFSET_PX). Plain centring when the sheet is closed.
   */
  function flyShifted(map: Leaflet.Map, at: LatLng, zoom: number): void {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const z = Math.max(map.getZoom(), zoom);
    const point = map.project([at.lat, at.lng], z);
    const target = sheetOpen
      ? map.unproject(point.subtract([0, SHEET_OFFSET_PX]), z)
      : map.unproject(point, z);
    if (reduced) map.setView(target, z);
    else map.flyTo(target, z, { duration: 1 });
  }

  /** UR1.2 recenter button: snap back to the latest fix, or request one. */
  /**
   * Retry entry shared by the recenter fallback and the guide sheet.
   * Resets the one-shot settle gate so a grant-after-denial fully settles
   * (marker + camera) instead of stranding the map on the HK-wide view —
   * that exact strand is the "granted but nothing happens" report.
   */
  function handleRetryLocate(): void {
    settledRef.current = false;
    retryGeo();
  }

  /** UR1.2 recenter button: snap back to the latest fix, or request one. */
  function handleRecenter(): void {
    const map = mapRef.current;
    if (map === null) return;
    if (
      geoStatus === "success" &&
      geoPosition !== null &&
      isWithinHongKong(geoPosition)
    ) {
      flyShifted(map, geoPosition, 15);
    } else {
      handleRetryLocate();
    }
  }

  /* Bottom-sheet drag: pull down past the threshold to dismiss. Direct DOM
   * transform during the gesture (no re-renders); snap-back animates via
   * the sheet's CSS transition when the transform is cleared. */
  function onSheetPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, dy: 0 };
  }

  function onSheetPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    const el = sheetRef.current;
    if (drag === null || el === null) return;
    drag.dy = Math.max(0, e.clientY - drag.startY);
    el.style.transform = `translateY(${drag.dy}px)`;
  }

  function onSheetPointerUp(): void {
    const drag = dragRef.current;
    const el = sheetRef.current;
    dragRef.current = null;
    if (el === null) return;
    el.style.transform = "";
    if (drag !== null && drag.dy > SHEET_DISMISS_DY) setSheetOpen(false);
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
    // UR1.2: dropping the pin collapses the sheet into a chip — the map
    // must never stay buried under the drawer on small screens.
    setSheetOpen(false);
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

  /**
   * Android-only: jump straight into the system Location settings.
   * Must run in a tap handler; Chrome resolves the intent scheme, other
   * browsers ignore it — manual steps stay on screen regardless.
   */
  function openAndroidSettings(): void {
    window.location.assign(ANDROID_LOCATION_SETTINGS_INTENT);
  }

  function handleZoom(delta: number): void {
    if (delta > 0) mapRef.current?.zoomIn();
    else mapRef.current?.zoomOut();
  }

  /** Second overlay step, matched to the exact browser in use. */
  function appStep(): string {
    if (browser === "chrome-ios") return t("stepAppChromeIos");
    if (browser === "in-app") return t("stepInApp");
    return platform === "ios" ? t("stepAppSafari") : t("stepAppAndroid");
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
        // UR1.3 immersive mobile: header (3.5rem) + section pt-3 (0.75rem)
        // above, map fills the rest of the first viewport. Desktop unchanged.
        className="h-[calc(100svh-4.25rem)] w-full md:h-[560px]"
        role="application"
        aria-label={t("mapLabel")}
      />

      {/* UR1.3 floating title — the retired slim hero lives on here. */}
      <div
        className={`${styles.above} font-hand pointer-events-none absolute top-3 left-1/2 max-w-[38%] -translate-x-1/2 truncate rounded-full border-2 bg-card/90 px-3 py-1 text-center text-sm font-bold backdrop-blur-sm`}
      >
        {heroT("title")}
      </div>

      {/* Notebook dot-grid over the tiles */}
      <div aria-hidden className={styles.paper} />

      {/* UR1.3 pick entry — idle-only pill above the mock badge. Hidden
          while any card is open: one bottom entry at a time, no pile-ups. */}
      {!sheetOpen && card === null && !(geoFailed && !guideDismissed) && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`${styles.above} font-hand absolute bottom-12 left-3 inline-flex max-w-[70%] items-center gap-2 rounded-full border-2 bg-card/95 px-4 py-2 text-base font-bold shadow-[3px_3px_0_var(--border)] backdrop-blur-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`}
        >
          {picked !== null && wantSaved ? (
            <>
              <span aria-hidden>{picked.emoji}</span>
              <span className="truncate">{picked.name}</span>
            </>
          ) : (
            <>
              <Dices size={18} aria-hidden />
              {t("pickCta")}
            </>
          )}
        </button>
      )}
      {sheetOpen && (
        <div
          ref={sheetRef}
          className={`${styles.above} absolute inset-x-3 bottom-3 max-h-[50%] overflow-y-auto rounded-2xl border-2 bg-card/30 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[3px_3px_0_var(--border)] backdrop-blur-xl motion-safe:transition-transform motion-safe:duration-300`}
        >
          <div
            aria-hidden
            className="h-6 w-full cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={onSheetPointerDown}
            onPointerMove={onSheetPointerMove}
            onPointerUp={onSheetPointerUp}
            onPointerCancel={onSheetPointerUp}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-(--border)" />
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            aria-label={t("close")}
            className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border-2"
          >
            <X size={16} aria-hidden />
          </button>
          <p className="font-hand pr-10 text-2xl leading-none font-bold">
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
            // UR1.3 compact result: one row (emoji + name/tagline) + one row
            // of two half-width buttons — reachable without inner scroll.
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <p className="text-4xl" aria-hidden>
                  {picked.emoji}
                </p>
                <div className="min-w-0">
                  <p className="truncate font-bold">{picked.name}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {picked.tagline}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleWant}
                  className="font-hand inline-flex items-center justify-center gap-1.5 rounded-full border-2 bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
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
      )}

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

      {/* Custom zoom controls (doodle pills, not Leaflet defaults).
          Lifted above any open bottom card so they never get buried. */}
      <div
        className={`${styles.above} absolute right-3 flex flex-col gap-2 ${
          sheetOpen || card !== null || (geoFailed && !guideDismissed)
            ? "bottom-[calc(50%+0.75rem)]"
            : "bottom-14 md:bottom-16"
        }`}
      >
        <button
          type="button"
          onClick={handleRecenter}
          aria-label={t("recenter")}
          title={t("recenter")}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-primary text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <LocateFixed size={18} aria-hidden />
        </button>
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

      {/* Slim status pill: locating, outside-HK, or a dismissed failure.
          Tapping the dismissed pill retries and reopens the guide. */}
      {(geoStatus === "locating" || outsideHk) && (
        <p
          role="status"
          className={`${styles.above} absolute bottom-3 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full border-2 bg-card/95 px-4 py-1.5 text-center text-xs font-bold md:text-sm`}
        >
          {geoStatus === "locating" && t("locating")}
          {outsideHk && t("outside")}
        </p>
      )}
      {geoFailed && guideDismissed && (
        <button
          type="button"
          onClick={() => {
            setGuideDismissed(false);
            handleRetryLocate();
          }}
          className={`${styles.above} absolute bottom-3 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full border-2 bg-card/95 px-4 py-1.5 text-center text-xs font-bold md:text-sm`}
        >
          {t("denied")} · {t("retryLocate")}
        </button>
      )}

      {/* Permission guide sheet: platform-matched steps. Mobile browsers
          remember a denial and in-app webviews block geolocation outright,
          so the fix is always OS/browser settings — never another silent
          request. iOS has no settings deep-link from the web; Android does. */}
      {geoFailed && !guideDismissed && (
        <div
          className={`${styles.above} absolute inset-x-3 bottom-3 rounded-2xl border-2 bg-card/95 p-4 text-left shadow-[3px_3px_0_var(--border)] backdrop-blur-sm md:right-auto md:left-1/2 md:w-96 md:-translate-x-1/2`}
        >
          <button
            type="button"
            onClick={() => setGuideDismissed(true)}
            aria-label={t("close")}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border-2"
          >
            <X size={16} aria-hidden />
          </button>
          <p className="font-hand pr-8 text-xl leading-tight font-bold">
            {t("overlayTitle")}
          </p>
          {platform === "ios" || platform === "android" ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>
                {platform === "ios" ? t("stepOsIos") : t("stepOsAndroid")}
              </li>
              <li>{appStep()}</li>
              <li>{t("stepRetryBack")}</li>
            </ol>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              {t("deniedGuide")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {platform === "android" && browser !== "in-app" && (
              <button
                type="button"
                onClick={openAndroidSettings}
                className="font-hand inline-flex items-center gap-1.5 rounded-full border-2 bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                {t("openSettings")}
              </button>
            )}
            <button
              type="button"
              onClick={handleRetryLocate}
              className="font-hand inline-flex items-center gap-1.5 rounded-full border-2 bg-accent px-4 py-1.5 text-sm font-bold text-accent-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              {t("retryLocate")}
            </button>
          </div>
        </div>
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PointerEvent as ReactPointerEvent } from "react";
import type * as Leaflet from "leaflet";
import { useLocale, useTranslations } from "next-intl";
import { Clock, Dices, MapPin, Plus, X } from "lucide-react";
import { MapFab } from "@/components/map/MapFab";

import { useGeolocation } from "@/hooks/useGeolocation";
import { useShake } from "@/hooks/useShake";
import { BUZZ_FOUND, BUZZ_MISS, BUZZ_PRIME, buzz } from "@/lib/haptics";
import { markShakeUsed } from "@/components/map/MapFab";
import { pickNearestRecentCheckin } from "@/lib/shake";
import { clusterPoints } from "@/lib/clusters";
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
import type { WantRecord } from "@/lib/wantRecord";
import { MOCK_ME } from "@/lib/me";
import {
  formatWantCoords,
  formatWantTime,
  loadWantRecord,
  resolvePlaceName,
  saveWantRecord,
} from "@/lib/wantRecord";
import {
  ANCHOR_PANEL_W,
  anchorPanel,
} from "@/lib/anchor";
import {
  DEFAULT_CENTER,
  HK_BOUNDS,
  OSM_ATTRIBUTION,
  OSM_MAX_NATIVE_ZOOM,
  OSM_URL,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  formatDistance,
  haversineMeters,
  isWithinHongKong,
} from "@/lib/geo";
import { BeerMugDoodle } from "@/components/marketing/BeerMugDoodle";
import {
  iconForDrinkName,
  iconForPickId,
} from "@/components/marketing/beer-icons/wall";
import { renderToStaticMarkup } from "react-dom/server";
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
/** UR1.8 sentinel for the 想喝 pin — opens the snapshot card. */
const WANT_ID = "want";
/** UR2.0 mock 性别标记文案 key（三态，数据源见 lib/me.ts）。 */
const GENDER_KEY = {
  male: "genderMale",
  female: "genderFemale",
  secret: "genderSecret",
} as const;

/** Pixels the camera shifts up so sheet-open content clears the drawer. */
const SHEET_OFFSET_PX = 180;
/** Down-drag distance on the sheet handle that dismisses the sheet. */
const SHEET_DISMISS_DY = 72;
/**
 * UR1.6 two-up frame: the open cheers card eats this much bottom space,
 * so the frame's bottom pad clears it and neither dot hides under the card.
 */
const FOCUS_CARD_CLEAR_PX = 240;
/**
 * UR1.6: closer than this, self and the check-in are the same spot for
 * framing purposes — fitBounds would dive to max zoom on a degenerate
 * bound, so fall back to a plain fly-to instead.
 */
const MIN_FOCUS_SEPARATION_M = 50;
/**
 * UR2.8 聚合半径（像素）：略大于单钉最大尺寸（56px）——两钉投影中心距
 * 掉进这个半径即视觉重叠，合成一簇。
 */
const OTHERS_CLUSTER_PX = 64;
export function DrinkMap({
  initialPickOpen = false,
}: {
  /** UR1.7 `?pick=1` deep-link: arrive in the fan-pick end state. */
  initialPickOpen?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("map");
  const heroT = useTranslations("hero");
  const router = useRouter();
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
  const othersLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const settledRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  // UR1.2 bottom sheet: closed pill <-> open half-sheet. Auto-closes into
  // a chip when the 想喝 pin drops so the map is never buried on small screens.
  const [sheetOpen, setSheetOpen] = useState(initialPickOpen);
  const [fabOpen, setFabOpen] = useState(initialPickOpen);
  // UR1.7: App Router reuses the client tree when only searchParams change
  // (/ → /?pick=1), so useState-initial alone misses menu clicks from home.
  // This fires only on a false→true transition (direct loads are covered
  // by the initializers above; the settle effect owns their camera).
  const prevPickOpen = useRef(initialPickOpen);
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
  // UR1.6: the init effect closes over the FIRST render, so the Leaflet
  // marker callbacks it registers would read stale geo forever. They go
  // through this ref instead — synced below on every geo change.
  const geoRef = useRef({ status: geoStatus, position: geoPosition });

  /**
   * UR1.6 focus-a-drinker: open their card and frame both of us.
   * Declared BEFORE the init effect (lint: no use-before-define) and reads
   * geo from geoRef (fresh), never from the render closure (stale).
   * With a fix: fitBounds(self, them) so both dots share the screen.
   * Without one (Q1 decision): just fly to them; the card shows the
   * locate hint instead of a distance. Outside-HK fixes still count —
   * the distance to HK is real even when the dot is parked.
   */
  function handleFocusPerson(c: Checkin): void {
    const map = mapRef.current;
    setSelectedId(c.id);
    if (map === null) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const self =
      geoRef.current.status === "success" && geoRef.current.position !== null
        ? geoRef.current.position
        : null;
    if (
      self === null ||
      haversineMeters(self, c.position) < MIN_FOCUS_SEPARATION_M
    ) {
      const z = Math.max(map.getZoom(), 14);
      if (reduced) map.setView([c.position.lat, c.position.lng], z);
      else map.flyTo([c.position.lat, c.position.lng], z, { duration: 1 });
      return;
    }
    const frame: [[number, number], [number, number]] = [
      [self.lat, self.lng],
      [c.position.lat, c.position.lng],
    ];
    if (reduced) {
      map.fitBounds(frame, { padding: [24, 24], animate: false });
    } else {
      map.fitBounds(frame, {
        paddingTopLeft: [24, 24],
        paddingBottomRight: [24, FOCUS_CARD_CLEAR_PX],
      });
    }
  }
  /**
   * UR2.8 他人 pin 层重建（init＋每次 zoomend 调）：当前 zoom 下投影到
   * 像素，按 OTHERS_CLUSTER_PX 贪心聚合。单成员＝原样单 pin（UR2.7 的
   * art／emoji 两款原封不动）；多成员＝一个 doodle 数字簇，点之放大散开。
   * 只读 refs＋模块常量，init effect 闭包首实例调用无 stale 问题（同
   * handleFocusPerson 口径，见 UR2.1 memory）。
   */
  function renderOthersPins(map: Leaflet.Map, L: typeof Leaflet): void {
    othersLayerRef.current?.remove();
    const pixels = MOCK_CHECKINS.map((c) => {
      const p = map.latLngToContainerPoint([c.position.lat, c.position.lng]);
      return { x: p.x, y: p.y };
    });
    const layer = L.layerGroup();
    for (const [i, cluster] of clusterPoints(
      pixels,
      OTHERS_CLUSTER_PX,
    ).entries()) {
      if (cluster.members.length === 1) {
        const idx = cluster.members[0] as number;
        const c = MOCK_CHECKINS[idx] as Checkin;
        // UR2.7 原样：有图方形设计钉，无图 emoji 圆钉（奇偶错峰倾斜保留）。
        const ArtIcon = iconForDrinkName(c.drinkName);
        const artHtml =
          ArtIcon === null
            ? null
            : `<div class="${styles.pinArt}">${renderToStaticMarkup(<ArtIcon />)}</div>`;
        const pinClass =
          idx % 2 === 0 ? styles.pin : `${styles.pin} ${styles.pinAlt}`;
        const marker = L.marker([c.position.lat, c.position.lng], {
          title: c.nickname,
          icon: L.divIcon({
            className: "",
            html: artHtml ?? `<div class="${pinClass}">${c.drinkEmoji}</div>`,
            iconSize: artHtml === null ? [40, 40] : [56, 56],
            iconAnchor: artHtml === null ? [20, 38] : [28, 52],
          }),
        });
        marker.on("click", () => handleFocusPerson(c));
        marker.addTo(layer);
        continue;
      }
      const at = map.containerPointToLatLng([cluster.centroid.x, cluster.centroid.y]);
      const n = cluster.members.length;
      const badge = L.marker(at, {
        title: t("clusterTitle", { n }),
        icon: L.divIcon({
          className: "",
          html: `<div class="${styles.pinCluster}">${n}</div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        }),
        zIndexOffset: 100 + i,
      });
      badge.on("click", () => {
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const z = Math.min(map.getZoom() + 2, ZOOM_MAX);
        if (reduced) map.setView(at, z);
        else map.flyTo(at, z, { duration: 0.8 });
      });
      badge.addTo(layer);
    }
    layer.addTo(map);
    othersLayerRef.current = layer;
  }
  /**
   * UR2.5 摇一摇流程：有效触发 → 24h 内最近 → 用户位置声纳 ~1.2s →
   * 复用 handleFocusPerson 开卡聚焦。按钮和真机摇动都走这里。
   */
  const [ripple, setRipple] = useState<{
    x: number;
    y: number;
    key: number;
  } | null>(null);
  const [shakeToast, setShakeToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  useEffect(() => {
    const timer = toastTimer.current;
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  function showShakeToast(msg: string): void {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setShakeToast(msg);
    toastTimer.current = window.setTimeout(() => setShakeToast(null), 3500);
  }

  // UR2.9 触发计数：每次触发（含 prime tick）＋1 重播卫星钮 rattle。
  // 归零走下面的 effect（shakeBurst 变化即重布防，连击自动顺延；async
  // continuation 写 state，refs 规则安全）。
  const [shakeBurst, setShakeBurst] = useState(0);
  function bumpBurst(): void {
    setShakeBurst((b) => b + 1);
  }
  useEffect(() => {
    if (shakeBurst === 0) return;
    const id = window.setTimeout(() => setShakeBurst(0), 600);
    return () => window.clearTimeout(id);
  }, [shakeBurst]);

  function runShakeFlow(): void {
    markShakeUsed();
    bumpBurst();
    const geo = geoRef.current;
    const self =
      geo.status === "success" && geo.position !== null ? geo.position : null;
    if (self === null) {
      buzz(BUZZ_MISS);
      showShakeToast(t("shakeNoGeo"));
      return;
    }
    const pick = pickNearestRecentCheckin(self, MOCK_CHECKINS, Date.now());
    if (pick === null) {
      buzz(BUZZ_MISS);
      showShakeToast(t("shakeNoneNearby"));
      return;
    }
    // 有结果：成功震型和 rattle＋声纳同步走；无 API（iPhone）时静默只剩动画。
    buzz(BUZZ_FOUND);
    const map = mapRef.current;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (map !== null && !reduced) {
      const pt = map.latLngToContainerPoint([self.lat, self.lng]);
      setRipple({ x: pt.x, y: pt.y, key: Date.now() });
      window.setTimeout(() => {
        setRipple(null);
        handleFocusPerson(pick);
      }, 1250);
    } else {
      // reduced-motion：跳过涟漪直接聚焦（handleFocusPerson 内走 setView）。
      handleFocusPerson(pick);
    }
  }

  // useShake 回调走内部 ref（和 geoRef 同一 stale-closure 解法），直接传即可。
  // UR2.9 prime：第一晃 tick 确认（按钮抖一下＋轻震），手感不断档。
  const { needsPermission, permission, requestPermission } = useShake(
    runShakeFlow,
    3000,
    () => {
      bumpBurst();
      buzz(BUZZ_PRIME);
    },
  );

  /** 摇摇按钮：iOS 先要动作权限（必须在点击手势里），再走同一流程。 */
  function handleShakeRequest(): void {
    if (needsPermission && permission !== "granted") {
      void requestPermission().then((ok) => {
        if (!ok) showShakeToast(t("shakeDenied"));
        else runShakeFlow();
      });
      return;
    }
    runShakeFlow();
  }

  const [sentIds, setSentIds] = useState<string[]>([]);
  const [picked, setPicked] = useState<Beer | null>(null);
  const [wantAt, setWantAt] = useState<LatLng | null>(null);
  const [wantSaved, setWantSaved] = useState(false);
  // UR1.8 frozen drop snapshot (null until the first 想喝, or after reset).
  const [wantRecord, setWantRecord] = useState<WantRecord | null>(null);
  // Place name fetched for the snapshot. Keyed by drop timestamp so a new
  // drop never flashes the previous name while its lookup is in flight.
  const [fetchedPlace, setFetchedPlace] = useState<{
    at: number;
    name: string;
  } | null>(null);
  const displayPlace =
    wantRecord?.placeName ??
    (fetchedPlace !== null &&
    wantRecord !== null &&
    fetchedPlace.at === wantRecord.at
      ? fetchedPlace.name
      : undefined);

  const isSelf = selectedId === SELF_ID;
  const isWant = selectedId === WANT_ID;
  /** Anchored card content: own marker, the 想喝 snapshot, a mock check-in, or nothing. */
  const card: "self" | "want" | Checkin | null = isSelf
    ? "self"
    : isWant && wantRecord !== null
      ? "want"
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
  /**
   * UR1.6 live self fix for the card distance. Render-time plain value —
   * every watch update re-renders, so the distance stays dynamic with no
   * extra state. Null (denied/failed) → the card shows the locate hint.
   */
  const selfFix =
    geoStatus === "success" && geoPosition !== null ? geoPosition : null;

  /* ---- UR2.1 anchored card ----
   * React 19 forbids ref reads during render, so the pin's screen point
   * lives in state: snapshotted when the card/fix changes, re-projected on
   * every camera 'move' (flyTo, button zoom). The subscription only exists
   * while a card is open — bare pans never re-render the tree. The first
   * snapshot goes through a microtask (set-state-in-effect allows async
   * continuations, never a sync body). */
  /** Map position the open card belongs to (frozen snapshot for 想喝). */
  const focusAt: LatLng | null =
    card === null
      ? null
      : card === "self"
        ? selfFix
        : card === "want"
          ? (wantRecord?.position ?? null)
          : card.position;
  const [view, setView] = useState<{
    x: number;
    y: number;
    cw: number;
    ch: number;
  } | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    const holder = holderRef.current;
    if (!mapReady || map === null || holder === null) return;
    if (card === null || focusAt === null) return;
    const snapshot = (): void => {
      const point = map.latLngToContainerPoint([
        focusAt.lat,
        focusAt.lng,
      ]);
      setView({
        x: point.x,
        y: point.y,
        cw: holder.clientWidth,
        ch: holder.clientHeight,
      });
    };
    void Promise.resolve().then(snapshot);
    map.on("move", snapshot);
    return () => {
      map.off("move", snapshot);
    };
  }, [mapReady, card, focusAt]);
  // Real panel height for the flip decision. Callback ref (not an effect)
  // so the set-state-in-effect rule stays quiet; the panel remounts per
  // card (key below), re-measuring on every content swap.
  const [panelH, setPanelH] = useState(0);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (el === null) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0) setPanelH(h);
  }, []);
  const anchor =
    card !== null && view !== null && view.cw > 0
      ? (() => {
          const panelW = Math.min(ANCHOR_PANEL_W, view.cw - 24);
          return {
            placement: anchorPanel(
              view.x,
              view.y,
              panelW,
              panelH,
              view.cw,
              view.ch,
            ),
            panelW,
          };
        })()
      : null;

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
      // Scroll-trap root cause (Vercel report): Leaflet's own stylesheet
      // pins touch-action:none on touch containers and wins the cascade
      // often enough that the CSS-module override alone did not hold on
      // device. Inline !important outranks every stylesheet rule.
      holder.style.setProperty(
        "touch-action",
        "pan-y pinch-zoom",
        "important",
      );
      // A map drag means "I'm navigating" — collapse the dial, no catcher.
      // UR2.1 (Q1 decision): the anchored card closes too — a navigating
      // user outruns any pin anyway, and re-tapping is one touch away.
      map.on("dragstart", () => {
        setFabOpen(false);
        setSelectedId(null);
      });
      // UR2.8: 他人 pin 层走聚合重建（首帧＋每次 zoomend），街区 zoom
      // 下全是单成员＝和原来一模一样的钉，全港 zoom 下近点合成簇。
      renderOthersPins(map, L);
      map.on("zoomend", () => {
        if (mapRef.current !== null && leafletRef.current !== null) {
          renderOthersPins(mapRef.current, leafletRef.current);
        }
      });
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
      othersLayerRef.current = null;
    };
    // init-once：renderOthersPins 只读 refs／模块常量／挂载时 locale 的 t
    //（同 handleFocusPerson 闭包口径，locale 切换是整树 remount）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* ---- UR1.8: resurrect the persisted snapshot after mount ----
   * State starts null on both server and client (no hydration split);
   * the stored record — pin included — returns in one effect pass. */
  useEffect(() => {
    // Microtask wrapper: the set-state-in-effect rule only allows setState
    // in an async continuation (same pattern as useGeolocation mount — see
    // .memory/2026-09-05-toolchain-pits.md).
    void Promise.resolve().then(() => {
      const saved = loadWantRecord();
      if (saved === null) return;
      setWantRecord(saved);
      setPicked(saved.beer);
      setWantAt(saved.position);
      setWantSaved(true);
    });
  }, []);

  /* ---- UR1.8 fix: resolve the stored position to a place name ----
   * Stored names win (offline reuse, no network). Otherwise one lookup per
   * drop, patched back into storage so the next cold start skips it.
   * All setStates live in the async continuation (never sync in the body),
   * per the set-state-in-effect rule. */
  useEffect(() => {
    if (wantRecord === null || wantRecord.placeName !== undefined) return;
    let cancelled = false;
    void resolvePlaceName(wantRecord.position, locale).then((name) => {
      if (cancelled || name === null) return;
      setFetchedPlace({ at: wantRecord.at, name });
      const patched: WantRecord = { ...wantRecord, placeName: name };
      setWantRecord(patched);
      saveWantRecord(patched);
    });
    return () => {
      cancelled = true;
    };
  }, [wantRecord, locale]);

  /* ---- UR1.6: keep the Leaflet-callback geo ref current ---- */
  useEffect(() => {
    geoRef.current = { status: geoStatus, position: geoPosition };
  }, [geoStatus, geoPosition]);

  /* ---- UR1.7 `?pick=1`: reproduce the hand-tapped fan-pick end state ----
   * Two legs with separate latches: opening the sheet/fan, and homing the
   * camera. Split because the fix may arrive AFTER the tap (locating) — a
   * single latch would swallow the camera leg forever. Retries on every
   * geo change until a fix flies; closing the sheet by hand never
   * resurrects (homed stays true until the param leaves).
   * Camera math mirrors flyShifted(..., openSheet=true) inline so this
   * effect keeps exact deps and adds no lint warnings. */
  const pickHomed = useRef(false);
  useEffect(() => {
    if (!initialPickOpen) {
      prevPickOpen.current = false;
      pickHomed.current = false;
      return;
    }
    if (!prevPickOpen.current) {
      prevPickOpen.current = true;
      // Sheet open = the dial hides itself per the UR1.3 rule, exactly
      // like tapping the fan pick entry by hand.
      setSheetOpen(true);
      setFabOpen(true);
    }
    const map = mapRef.current;
    if (
      pickHomed.current ||
      map === null ||
      geoStatus !== "success" ||
      geoPosition === null ||
      !isWithinHongKong(geoPosition)
    ) {
      return;
    }
    pickHomed.current = true;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const z = Math.max(map.getZoom(), 15);
    const point = map.project([geoPosition.lat, geoPosition.lng], z);
    const target = map.unproject(point.subtract([0, SHEET_OFFSET_PX]), z);
    if (reduced) map.setView(target, z);
    else map.flyTo(target, z, { duration: 1 });
  }, [initialPickOpen, geoStatus, geoPosition]);

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
    // UR1.8: the 想喝 pin opens its frozen snapshot card.
    // UR2.7 追加：和他人 pin 同构 —— 推荐酒有专属插畫就画设计稿（红色款
    // 方形钉＋声纳圈），没图才回 emoji 圆钉。
    const WantArt = iconForPickId(picked.id);
    const wantArtHtml =
      WantArt === null
        ? null
        : `<div class="${styles.pinArtWant}">${renderToStaticMarkup(<WantArt />)}</div>`;
    const pin = L.marker([wantAt.lat, wantAt.lng], {
      title: picked.name,
      icon: L.divIcon({
        className: "",
        html:
          wantArtHtml ??
          `<div class="${styles.pinWant}">${picked.emoji}</div>`,
        iconSize: wantArtHtml === null ? [48, 48] : [56, 56],
        iconAnchor: wantArtHtml === null ? [24, 44] : [28, 52],
      }),
    });
    pin.on("click", () => setSelectedId(WANT_ID));
    const layer = L.layerGroup([
      L.circle([wantAt.lat, wantAt.lng], {
        radius: 350,
        color: ink,
        weight: 2.5,
        dashArray: "8 6",
        fillColor: ink,
        fillOpacity: 0.08,
      }),
      pin,
    ]);
    layer.addTo(map);
    wantLayerRef.current = layer;
    map.setView([wantAt.lat, wantAt.lng], Math.max(map.getZoom(), 14));
  }, [mapReady, wantAt, picked]);

  function handlePick(): void {
    // Rolling a new beer touches ONLY the candidate — the old pin and its
    // snapshot stay alive until a new 想喝 actually drops (handleWant
    // overwrites both). Retiring them here wiped the last check-in the
    // moment the user re-rolled (UR1.8 bug report).
    setPicked(pickRandomBeer());
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

  /** Zoom step for the speed-dial +/- actions (scroll-wheel stays off). */
  function handleZoom(delta: 1 | -1): void {
    mapRef.current?.setZoom(mapRef.current.getZoom() + delta);
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
    // UR1.8: freeze the drop moment — beer, clock, and fix travel together
    // from here on; the pin and the card only ever read this snapshot.
    const record: WantRecord = { beer: picked, at: Date.now(), position: at };
    setWantRecord(record);
    saveWantRecord(record);
    // UR1.2: dropping the pin collapses the sheet into a chip — the map
    // must never stay buried under the drawer on small screens.
    setSheetOpen(false);
  }

  function handleSelfPick(): void {
    // From your own pin: close the card, roll, and OPEN the sheet — the
    // result must land somewhere visible. The old comment claimed the
    // panel was "now visible", true in UR1.1 (always-open panel) but false
    // since UR1.2 turned it into a default-closed sheet; this path has
    // silently done nothing visible ever since (UR1.8 bug report).
    setSelectedId(null);
    handlePick();
    setSheetOpen(true);
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

      {/* Pick entry lives in the speed-dial now (single entry point) —
          the sheet opens from there or from the self-pin card. */}
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
              <div className="flex items-center gap-4">
                {(() => {
                  // UR2.7 有专属插畫就是主角（h-28 左图右信息），
                  // 没图保持原 emoji 紧凑行，不硬凑。
                  const PickIcon = iconForPickId(picked.id);
                  return PickIcon !== null ? (
                    <span
                      key={picked.id}
                      className={`${styles.pickArtIn} block h-28 w-auto shrink-0 [&>svg]:h-full [&>svg]:w-auto`}
                    >
                      <PickIcon />
                    </span>
                  ) : (
                    <p className="text-4xl" aria-hidden>
                      {picked.emoji}
                    </p>
                  );
                })()}
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

      {/* UR2.5 摇一摇声纳：盖在瓦片上但 pointer-events 关死，
          1250ms 后卸载并聚焦，绝不挡地图操作。 */}
      {ripple !== null && (
        <span
          key={ripple.key}
          aria-hidden
          className={`${styles.above} ${styles.shakeRipple} pointer-events-none`}
          style={{ left: ripple.x, top: ripple.y }}
        />
      )}
      {/* UR2.5 摇摇 toast：空结果／无定位／权限拒绝的唯一出口，3.5 秒自散。 */}
      {shakeToast !== null && (
        <p
          role="status"
          className={`${styles.above} ${styles.fabBubblePop} pointer-events-none absolute top-24 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full border-2 bg-card/95 px-4 py-1.5 text-center text-xs font-bold md:text-sm`}
        >
          {shakeToast}
        </p>
      )}

      {/* Speed-dial: every map action consolidated in one button. Hides
          while any bottom card is open (the beer lives in the corner,
          nowhere else); closing the card brings it back. */}
      <MapFab
        open={fabOpen}
        onToggle={() => setFabOpen((v) => !v)}
        onClose={() => setFabOpen(false)}
        hidden={
          sheetOpen || card !== null || (geoFailed && !guideDismissed)
        }
        hasWant={picked !== null && wantSaved}
        onPick={() => setSheetOpen(true)}
        onPhoto={() => router.push("/camera")}
        onRecenter={handleRecenter}
        onFitHk={handleFitHk}
        onZoomIn={() => handleZoom(1)}
        onZoomOut={() => handleZoom(-1)}
        onShake={handleShakeRequest}
        shakeBurst={shakeBurst}
      />

      {/* MOCK badge — top-left now; bottom-left belongs to the beer dial. */}
      <p
        className={`${styles.above} absolute top-3 left-3 flex items-center gap-1.5 rounded-full border-2 bg-card/95 px-3 py-1 text-xs font-bold`}
      >
        <span aria-hidden className={styles.liveDot} />
        {t("mockBadge")}
      </p>

      {/* Slim status pill: locating, outside-HK, or a dismissed failure.
          Tapping the dismissed pill retries and reopens the guide. */}
      {/* UR1.4：扇形展开时让位隐藏，收起即回来 */}
      {(geoStatus === "locating" || outsideHk) && !fabOpen && (
        <p
          role="status"
          className={`${styles.above} absolute top-14 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full border-2 bg-card/95 px-4 py-1.5 text-center text-xs font-bold md:text-sm`}
        >
          {geoStatus === "locating" && t("locating")}
          {outsideHk && t("outside")}
        </p>
      )}
      {geoFailed && guideDismissed && !fabOpen && (
        <button
          type="button"
          onClick={() => {
            setGuideDismissed(false);
            handleRetryLocate();
          }}
          className={`${styles.above} absolute top-14 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full border-2 bg-card/95 px-4 py-1.5 text-center text-xs font-bold md:text-sm`}
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

      {/* UR2.1 anchored pin card — floats next to the tapped pin (with a
          tail nub pointing at it) instead of sitting centered at the
          bottom. The washi tape retired with the bottom dock: the tail is
          the pointing device now. */}
      {card !== null && anchor !== null && (
        <div
          key={
            card === "self" ? "self" : card === "want" ? "want" : card.id
          }
          ref={measureRef}
          className={`${styles.above} absolute rounded-2xl border-2 bg-card/95 p-4 shadow-[3px_3px_0_var(--border)] backdrop-blur-sm`}
          style={{
            left: anchor.placement.left,
            top: anchor.placement.top,
            width: anchor.panelW,
          }}
        >
          <span
            aria-hidden
            className={`absolute h-3.5 w-3.5 rotate-45 border-2 bg-card ${
              anchor.placement.below ? "-top-2" : "-bottom-2"
            }`}
            // tailX is the nub center; h-3.5 is 14px, so shift half back.
            style={{ left: anchor.placement.tailX - 7 }}
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
          ) : card === "want" ? (
            // UR1.8 frozen snapshot — beer, clock, and fix from drop time.
            wantRecord !== null ? (
              <div>
                <div className="flex items-center gap-4">
                  {(() => {
                    // UR2.7 想喝卡同构：有图上主角位，没图保持原 emoji 行。
                    const WantIcon = iconForPickId(wantRecord.beer.id);
                    return WantIcon !== null ? (
                      <span
                        key={wantRecord.beer.id}
                        className={`${styles.pickArtIn} block h-24 w-auto shrink-0 [&>svg]:h-full [&>svg]:w-auto`}
                      >
                        <WantIcon />
                      </span>
                    ) : (
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-full border-2 text-2xl"
                        aria-hidden
                      >
                        {wantRecord.beer.emoji}
                      </span>
                    );
                  })()}
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold">
                      {t("wantTitle")}
                      <span className="font-hand rounded-full border-2 bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                        {t(GENDER_KEY[MOCK_ME.gender])}
                      </span>
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {wantRecord.beer.emoji} {wantRecord.beer.name}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <p className="flex items-center gap-1.5">
                    <Clock size={15} aria-hidden />
                    {formatWantTime(wantRecord.at, locale)}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin size={15} aria-hidden />
                    {displayPlace ?? formatWantCoords(wantRecord.position)}
                  </p>
                  {displayPlace !== undefined && (
                    <p className="text-muted-foreground pl-6 text-xs">
                      {formatWantCoords(wantRecord.position)}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {t("wantFrozenNote")}
                  </p>
                </div>
              </div>
            ) : null
          ) : (
            <>
              {/* UR2.7 追加同构 hero 槽：酒名命中已画品牌 → 设计稿放主角位
                  （头像缩成角标保身份）；没命中保持原放大头像，不硬凑。 */}
              <div className="flex items-center gap-4">
                {(() => {
                  const DrinkIcon = iconForDrinkName(card.drinkName);
                  return DrinkIcon !== null ? (
                    <span className="relative shrink-0">
                      <span
                        className={`${styles.pickArtIn} block h-24 w-auto [&>svg]:h-full [&>svg]:w-auto`}
                      >
                        <DrinkIcon />
                      </span>
                      <span
                        className="absolute -right-2 -bottom-2 flex h-9 w-9 items-center justify-center rounded-full border-2 bg-card text-xl"
                        aria-hidden
                      >
                        {card.avatarEmoji}
                      </span>
                    </span>
                  ) : (
                    <span
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-3xl"
                      aria-hidden
                    >
                      {card.avatarEmoji}
                    </span>
                  );
                })()}
                <div>
                  <p className="flex items-center gap-2 font-bold">
                    {card.nickname} · {card.area}
                    {/* UR2.0 他人性别标记（mock 数据，见 lib/checkins.ts） */}
                    <span className="font-hand rounded-full border-2 bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                      {t(GENDER_KEY[card.gender])}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {card.drinkEmoji}{" "}
                    {t("drinking", { drink: card.drinkName })}
                  </p>
                  {/* UR1.6 live distance — pure render calc from the watch
                      fix, so it tracks you as you move. */}
                  <p className="text-muted-foreground text-sm">
                    {selfFix !== null
                      ? t("distanceAway", {
                          d: formatDistance(
                            haversineMeters(selfFix, card.position),
                          ),
                        })
                      : t("needLocateForDistance")}
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

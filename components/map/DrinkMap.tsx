"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PointerEvent as ReactPointerEvent } from "react";
import type * as Leaflet from "leaflet";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Dices,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { resolveCityCode } from "@/lib/city";

import { CityIcon } from "./CityIcon";
import { MapFab } from "@/components/map/MapFab";

import { useGeolocation } from "@/hooks/useGeolocation";
import { useShake } from "@/hooks/useShake";
import {
  BUZZ_CHEERS,
  BUZZ_FOUND,
  BUZZ_MISS,
  BUZZ_PRIME,
  buzz,
} from "@/lib/haptics";
import {
  patchVisitArea,
  shouldShowLastPlace,
  touchVisit,
} from "@/lib/visit";
import type { LastVisit } from "@/lib/visit";
import {
  canCheers,
  cheersRemaining,
  loadSentToday,
  saveSentToday,
} from "@/lib/cheers";
import { markShakeUsed } from "@/components/map/MapFab";
import { pickNearestRecentCheckin } from "@/lib/shake";
import { clusterPoints } from "@/lib/clusters";
import { isOnline } from "@/lib/nearby";
import { trailStops } from "@/lib/trail";
import {
  ANDROID_LOCATION_SETTINGS_INTENT,
  detectBrowser,
  detectPlatform,
} from "@/lib/device";
import type { DeviceBrowser, DevicePlatform } from "@/lib/device";
import { MOCK_CHECKINS } from "@/lib/checkins";
import type { Checkin } from "@/lib/checkins";
import {
  BEER_CATEGORIES,
  beersInCategory,
  categoryOfBeer,
  pickRandomBatch,
  pickRandomBeer,
  pickRandomBeerIn,
  pickSwapBatch,
} from "@/lib/beers";
import type { Beer } from "@/lib/beers";
import type { LatLng } from "@/lib/geo";
import type { WantRecord } from "@/lib/wantRecord";
import { MOCK_ME } from "@/lib/me";
import {
  formatWantCoords,
  formatWantTime,
  loadWantHistory,
  removeWantAt,
  resolvePlaceName,
  saveWantHistory,
  swapWantBeer,
  upsertWantHistory,
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
 * UR3.0 碰杯特效时长（ms）：两杯摆入 0.5s＋碰杯颤动＋星形冲击＋泡沫＋
 * 大字，2.2s 收进“已乾杯”收据态（用户嫌 1.3s 消失太快）。结尾 0.2s 整层
 * 淡出，不硬切。reduced-motion 下直接收据（特效层不渲染）。
 */
const CHEERS_FX_MS = 2200;
/**
 * UR3.1 晃杯时刻定长（ms）：和 CSS 摆荡 1.25s 对齐，到点拆罩聚焦。
 * UR2.5 起就是这个数（原声纳 1250ms），行为不变，只换皮。
 */
const SHAKE_SEARCH_MS = 1250;
/**
 * UR2.8 聚合半径（像素）：略大于单钉最大尺寸（56px）——两钉投影中心距
 * 掉进这个半径即视觉重叠，合成一簇。
 */
const OTHERS_CLUSTER_PX = 64;
/**
 * UR3.3 mock 对方回话延迟（ms）：已发出 3s 后按该人剧本接受／婉拒。
 * 真后端由对方点按钮，无此定时。
 */
const INVITE_MOCK_MS = 3000;
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
  const trailLayerRef = useRef<Leaflet.LayerGroup | null>(null);
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
  function renderOthersPins(
    map: Leaflet.Map,
    L: typeof Leaflet,
    now: number,
  ): void {
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
        // UR3.3 在线绿点缀右上角（两款钉同挂，簇不挂——簇是多人的）。
        const onlineDot = isOnline(c, now)
          ? `<span class="${styles.pinOnline}"></span>`
          : "";
        const ArtIcon = iconForDrinkName(c.drinkName);
        const artHtml =
          ArtIcon === null
            ? null
            : `<div class="${styles.pinArt}">${renderToStaticMarkup(<ArtIcon />)}${onlineDot}</div>`;
        const pinClass =
          idx % 2 === 0 ? styles.pin : `${styles.pin} ${styles.pinAlt}`;
        const marker = L.marker([c.position.lat, c.position.lng], {
          title: c.nickname,
          icon: L.divIcon({
            // UR3.4 wtd-others：足迹模式置灰整层（CSS .trailDim）。
            className: "wtd-others",
            html:
              artHtml ??
              `<div class="${pinClass}">${c.drinkEmoji}${onlineDot}</div>`,
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
          // UR3.4 wtd-others：簇也是他人的，一起置灰。
          className: "wtd-others",
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
   * UR2.5 摇一摇流程：有效触发 → 24h 内最近 → 晃杯时刻 ~1.25s →
   * 复用 handleFocusPerson 开卡聚焦。按钮和真机摇动都走这里。
   * UR3.1 雷达涟漪退役，换毛玻璃晃杯罩（shakeSearch）。
   */
  const [shakeSearch, setShakeSearch] = useState<{ key: number } | null>(null);
  const [shakeToast, setShakeToast] = useState<string | null>(null);
  // UR3.0 reduced-motion 开关（mount 量一次，SSR 首帧 false 反正无特效可播；
  // 写入走 microtask，同步写撞 set-state-in-effect，见 UR1.8 memory）。
  const [reducedMotion, setReducedMotion] = useState(false);
  // UR3.3 在线判定用的 now 快照（render 里禁 Date.now.，mount 取一次；
  // 5min 窗口相对 mock 种子同代，整会话不漂移，够 mock 用）。
  // UR3.5 上次访问同批取出（读完即写 now，首访回 null）。
  const [nowMs, setNowMs] = useState(0);
  const [lastVisit, setLastVisit] = useState<LastVisit | null>(null);
  const [currentArea, setCurrentArea] = useState<string | null>(null);
  useEffect(() => {
    void Promise.resolve().then(() => {
      setReducedMotion(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      const now = Date.now();
      setNowMs(now);
      setLastVisit(touchVisit(now));
    });
  }, []);
  // UR3.5 当前区：geo 成功即反查（内置 memo 去重），回来补进本次访问戳。
  useEffect(() => {
    if (
      geoStatus !== "success" ||
      geoPosition === null ||
      !isWithinHongKong(geoPosition)
    ) {
      return;
    }
    let cancelled = false;
    void resolvePlaceName(geoPosition, locale).then((name) => {
      if (cancelled || name === null) return;
      setCurrentArea(name);
      patchVisitArea(name);
    });
    return () => {
      cancelled = true;
    };
  }, [geoStatus, geoPosition, locale]);

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
    // 有结果：成功震型和 rattle＋晃杯罩同步走；无 API（iPhone）时静默只剩动画。
    buzz(BUZZ_FOUND);
    // UR3.1 晃杯时刻定长（CSS 摆荡 1.25s 对齐，到点拆罩聚焦）。
    if (!reducedMotion) {
      setShakeSearch({ key: Date.now() });
      window.setTimeout(() => {
        setShakeSearch(null);
        handleFocusPerson(pick);
      }, SHAKE_SEARCH_MS);
    } else {
      // reduced-motion：跳过晃杯罩直接聚焦（handleFocusPerson 内走 setView）。
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

  // UR3.2 每日 15 次乾杯上限（mock 持久化：localStorage 按 HK 自然天）。
  // 首帧 [] 两端一致，mount 后 hydrate 当日记录（UR1.8 配方）；提交走
  // sentIdsRef 读最新（effect 闭包 stale-safe，UR2.5 口径）。
  const [sentIds, setSentIds] = useState<string[]>([]);
  const sentIdsRef = useRef<string[]>([]);
  useEffect(() => {
    sentIdsRef.current = sentIds;
  });
  useEffect(() => {
    void Promise.resolve().then(() => {
      const restored = loadSentToday(new Date());
      sentIdsRef.current = restored;
      setSentIds(restored);
    });
  }, []);
  const [picked, setPicked] = useState<Beer | null>(null);
  const [wantSaved, setWantSaved] = useState(false);
  /* UR3.8 兩層面板：pickLanes 為 true 即 L1 品種層（此時 picked 若有舊結果，
   * L1 優先顯示）；pickLaneId 記住 L2 結果所屬大類（「換一款」不出類）。 */
  const [pickLanes, setPickLanes] = useState(initialPickOpen);
  const [pickLaneId, setPickLaneId] = useState<string | null>(null);
  const [pickBatch, setPickBatch] = useState<Beer[]>([]);
  /* UR3.9 v2 own-record swap batch: null = collapsed. Keyed by record `at`
   * so switching records auto-hides a stale batch (no effect needed). */
  const [swapOpenFor, setSwapOpenFor] = useState<number | null>(null);
  const [swapBatch, setSwapBatch] = useState<Beer[]>([]);
  /* UR3.9 v3 L2 照片輪詢：當前高亮格序號（點點＋箭頭用）；strip 滾動時
   * 由 onScroll 回寫，箭頭按卡寬步進。 */
  const [batchIndex, setBatchIndex] = useState(0);
  const batchStripRef = useRef<HTMLDivElement | null>(null);
  // UR1.8 frozen drop snapshot (null until the first 想喝, or after reset).
  const [wantRecord, setWantRecord] = useState<WantRecord | null>(null);
  // UR3.7 删除两段确认：只对正在看的 at 武装，换条看自动解除，无需 effect。
  const [confirmAt, setConfirmAt] = useState<number | null>(null);
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
  // UR3.5 登录态三色（色块走 CSS module／标准 muted，圆点跟 currentColor）。
  const meStatusTone =
    geoStatus === "success"
      ? styles.inviteOk
      : geoFailed
        ? styles.meOffline
        : "text-muted-foreground";
  const meStatusText =
    geoStatus === "success"
      ? t("meOnline")
      : geoFailed
        ? t("meOffline")
        : t("meLocating");

  /**
   * UR1.6 live self fix for the card distance. Render-time plain value —
   * every watch update re-renders, so the distance stays dynamic with no
   * extra state. Null (denied/failed) → the card shows the locate hint.
   */
  const selfFix =
    geoStatus === "success" && geoPosition !== null ? geoPosition : null;
  // UR3.5+ 城市图形：真 GPS＋真区名才出码，无码回退 Building2（不编造）。
  const cityCode = resolveCityCode(selfFix, currentArea);
  const cityLabelKey =
    cityCode === null ? "cityName" : (`cityName_${cityCode}` as const);

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
  // so the set-state-in-effect rule stays quiet; ResizeObserver re-measures
  // on every content swap (swap batch open, delete-confirm toggle, cheers
  // receipt) — mount-once measuring left tall cards clipped by the map edge
  // (UR3.9 v3 report). Rounded ints avoid subpixel observe→set loops.
  const [panelH, setPanelH] = useState(0);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (el === null) return;
    const measure = (): void => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) setPanelH((prev) => (prev === h ? prev : h));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
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
      // now 取调用时刻（effect／事件上下文可调 impure，render 内不行）。
      // UR3.4 他人钉挂全局类 wtd-others：足迹模式下整层置灰（CSS 见 trailDim）。
      renderOthersPins(map, L, Date.now());
      map.on("zoomend", () => {
        if (mapRef.current !== null && leafletRef.current !== null) {
          renderOthersPins(mapRef.current, leafletRef.current, Date.now());
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
      trailLayerRef.current = null;
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
   * the stored record — pin included — returns in one effect pass.
   * UR3.4 bug 修：单槽改史槽（加推荐酒不再清旧数据， legacy 单键自动迁移）。 */
  const [wantHistory, setWantHistory] = useState<WantRecord[]>([]);
  const wantHistoryRef = useRef<WantRecord[]>([]);
  useEffect(() => {
    wantHistoryRef.current = wantHistory;
  });
  useEffect(() => {
    // Microtask wrapper: the set-state-in-effect rule only allows setState
    // in an async continuation (same pattern as useGeolocation mount — see
    // .memory/2026-09-05-toolchain-pits.md).
    void Promise.resolve().then(() => {
      const history = loadWantHistory();
      if (history.length === 0) return;
      const latest = history[history.length - 1] as WantRecord;
      setWantHistory(history);
      setWantRecord(latest);
      setPicked(latest.beer);
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
      // UR3.4 史槽：同 at 条目一起补地名（旧的单键 save 已退役）。
      const next = wantHistoryRef.current.map((r) =>
        r.at === patched.at ? patched : r,
      );
      wantHistoryRef.current = next;
      setWantHistory(next);
      saveWantHistory(next);
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
      setPickLanes(true);
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

  /* ---- 「想喝」 pin layer ----
   * UR3.4 bug 修：一枚钉改一史一钉（最新带圈，旧钉保留可点回看）。
   * 点任意史钉＝切 wantRecord 开卡（卡片代码零改，只换数据源）。 */
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || map === null || L === null) return;
    wantLayerRef.current?.remove();
    wantLayerRef.current = null;
    if (wantHistory.length === 0) return;

    const ink =
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--doodle-red")
        .trim() || "#b3261e";
    // UR1.8: the 想喝 pin opens its frozen snapshot card.
    // UR2.7 追加：和他人 pin 同构 —— 推荐酒有专属插畫就画设计稿（红色款
    // 方形钉＋声纳圈），没图才回 emoji 圆钉。
    const layer = L.layerGroup();
    const latest = wantHistory[wantHistory.length - 1] as WantRecord;
    for (const entry of wantHistory) {
      const Art = iconForPickId(entry.beer.id);
      const html =
        Art === null
          ? `<div class="${styles.pinWant}">${entry.beer.emoji}</div>`
          : `<div class="${styles.pinArtWant}">${renderToStaticMarkup(<Art />)}</div>`;
      const isLatest = entry.at === latest.at;
      const size: [number, number] = Art === null ? [48, 48] : [56, 56];
      const pin = L.marker([entry.position.lat, entry.position.lng], {
        title: entry.beer.name,
        icon: L.divIcon({
          className: "",
          html,
          iconSize: size,
          iconAnchor: [size[0] / 2, size[1] - 4],
        }),
      });
      pin.on("click", () => {
        setWantRecord(entry);
        setSelectedId(WANT_ID);
      });
      pin.addTo(layer);
      if (isLatest) {
        L.circle([entry.position.lat, entry.position.lng], {
          radius: 350,
          color: ink,
          weight: 2.5,
          dashArray: "8 6",
          fillColor: ink,
          fillOpacity: 0.08,
        }).addTo(layer);
      }
    }
    layer.addTo(map);
    wantLayerRef.current = layer;
    map.setView(
      [latest.position.lat, latest.position.lng],
      Math.max(map.getZoom(), 14),
    );
  }, [mapReady, wantHistory]);

  /* UR3.9 v3 開板即見酒：啤酒鈕／深鏈／空足跡 CTA 都直達 L1 輪詢，
   * 不再停空 CTA（RAW：一開始面板加載就有酒類圖片）。 */
  function openPickSheet(): void {
    setPickLanes(true);
    setSheetOpen(true);
  }

  /* UR3.8 L2 入口：選定大類 → 該類內隨機抽品牌（映射缺類回退全域，
   * 不白屏）。Rolling touches ONLY the candidate — 舊釘＋快照留到真正落
   * 「想喝」才換（UR1.8 bug report 同理）。 */
  function handlePickLane(laneId: string): void {
    const batch = pickRandomBatch(laneId, 6);
    setPickBatch(batch);
    setBatchIndex(0);
    setPickLaneId(laneId);
    setPickLanes(false);
    // Keep picked in sync for MapFab red-dot; L2 UI now reads batch.
    setPicked(batch[0] ?? null);
  }

  /* UR3.9 換下一批：同類內重洗，盡量不與上一批完全重疊（最多重試 3 次；
   * 小類如紅酒僅 1 款，重疊不可避免，不算錯）。 */
  function handleRefreshBatch(): void {
    const laneId = pickLaneId;
    if (laneId === null) return;
    const prevKey = pickBatch.map((b) => b.id).join(",");
    let next = pickRandomBatch(laneId, 6);
    for (
      let i = 0;
      i < 3 && next.map((b) => b.id).join(",") === prevKey && next.length > 1;
      i += 1
    ) {
      next = pickRandomBatch(laneId, 6);
    }
    setPickBatch(next);
    setBatchIndex(0);
    setPicked(next[0] ?? null);
  }

  /** 輪詢步進寬＝首卡寬＋gap（gap-3＝12px）；點點由 onScroll 回寫。 */
  function batchStep(): number {
    const el = batchStripRef.current;
    if (el === null) return 220;
    const card = el.querySelector("[data-batch-card]");
    return (card instanceof HTMLElement ? card.offsetWidth : 208) + 12;
  }
  function scrollBatch(dir: 1 | -1): void {
    const el = batchStripRef.current;
    if (el === null) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({ left: dir * batchStep(), behavior: reduced ? "auto" : "smooth" });
  }
  function handleBatchScroll(): void {
    const el = batchStripRef.current;
    if (el === null) return;
    const idx = Math.max(
      0,
      Math.min(pickBatch.length - 1, Math.round(el.scrollLeft / batchStep())),
    );
    setBatchIndex((prev) => (prev === idx ? prev : idx));
  }

  /* UR3.9 點格即落釘：無需單獨「想喝」按鈕（RAW：不希望用戶手動點想喝）。
   * 與 L1 隱性補全同走 dropWant，pin／卡／足跡只見真品牌。 */
  function handleBatchWant(beer: Beer): void {
    setPicked(beer);
    dropWant(beer);
  }

  /* UR3.8 隱性補全：L1 每類直打 —— 按下瞬間背後抽該類具體品牌再落釘，
   * 之後與 L2 想喝走完全同一條 dropWant，面板代碼零特判。 */
  function handleLaneWant(laneId: string): void {
    dropWant(pickRandomBeerIn(laneId) ?? pickRandomBeer());
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

  /**
   * Shared drop core — L1 隱性補全 and UR3.9 批量格 both land here with a
   * concrete brand, so pins / cards / trail never see lane-only check-ins.
   */
  function dropWant(beer: Beer): void {
    const map = mapRef.current;
    // Prefer the real position; otherwise drop the pin at the map centre.
    const at =
      geoStatus === "success" &&
      geoPosition !== null &&
      isWithinHongKong(geoPosition)
        ? geoPosition
        : map !== null
          ? { lat: map.getCenter().lat, lng: map.getCenter().lng }
          : DEFAULT_CENTER;
    setWantSaved(true);
    // UR1.8: freeze the drop moment — beer, clock, and fix travel together
    // from here on; the pin and the card only ever read this snapshot.
    // UR3.4 bug 修：追加进史（旧的不清），上限截尾保最新。
    // eslint-disable-next-line react-hooks/purity -- dropWant is an event handler (click), not render
    const record: WantRecord = { beer, at: Date.now(), position: at };
    // UR3.4 同店顶替：10m 内算同一位置（GPS 漂移），旧条让位，不叠钉。
    const next = upsertWantHistory(wantHistoryRef.current, record);
    wantHistoryRef.current = next;
    setWantHistory(next);
    saveWantHistory(next);
    setWantRecord(record);
    // UR1.2: dropping the pin collapses the sheet into a chip — the map
    // must never stay buried under the drawer on small screens.
    setSheetOpen(false);
  }

  /* ---- UR3.7 我的打卡可编辑（UR3.9 v2 改批次自选） ----
   * 换酒：同条目只换 beer（at／位置／地名不动，pin 不挪位）；候选是同类
   * 批次（`pickSwapBatch`，当前除外），点格即换，不再盲摇；存储＋state 同调。
   * 删除：按 at 丢条；删的是正在看的→改看最新，删光→清状态关卡。 */
  function handleSwapToggle(): void {
    if (wantRecord === null) return;
    if (swapOpenFor === wantRecord.at) {
      setSwapOpenFor(null);
      return;
    }
    setSwapBatch(pickSwapBatch(wantRecord.beer, 6));
    setSwapOpenFor(wantRecord.at);
  }
  function handleSwapRefresh(): void {
    if (wantRecord === null || swapOpenFor !== wantRecord.at) return;
    const prevKey = swapBatch.map((b) => b.id).join(",");
    let next = pickSwapBatch(wantRecord.beer, 6);
    for (
      let i = 0;
      i < 3 && next.map((b) => b.id).join(",") === prevKey && next.length > 1;
      i += 1
    ) {
      next = pickSwapBatch(wantRecord.beer, 6);
    }
    setSwapBatch(next);
  }
  function handleSwapTo(beer: Beer): void {
    if (wantRecord === null) return;
    const record: WantRecord = { ...wantRecord, beer };
    const next = swapWantBeer(wantHistoryRef.current, record.at, beer);
    wantHistoryRef.current = next;
    setWantHistory(next);
    saveWantHistory(next);
    setWantRecord(record);
    setPicked(beer);
    setSwapOpenFor(null);
  }
  function handleDeleteWant(): void {
    if (wantRecord === null) return;
    const next = removeWantAt(wantHistoryRef.current, wantRecord.at);
    wantHistoryRef.current = next;
    setWantHistory(next);
    saveWantHistory(next);
    setConfirmAt(null);
    setSwapOpenFor(null);
    if (next.length === 0) {
      setWantRecord(null);
      setPicked(null);
      setWantSaved(false);
      setSelectedId(null);
      return;
    }
    const latest = next[next.length - 1] as WantRecord;
    setWantRecord(latest);
    setPicked(latest.beer);
  }
  function handleSelfPick(): void {
    // From your own pin: close the card and OPEN the sheet at the L1 lanes —
    // the user picks a lane first (UR3.8), so there is no blind global roll
    // here anymore. (UR1.8 bug report: this path must land somewhere visible.)
    setSelectedId(null);
    openPickSheet();
  }

  // UR3.0 碰杯时刻：点乾杯先播 1.3s 特效（杯碰杯＋震），再提交收据。
  // 定时提交走 effect（timeout continuation 写 state，lint 安全）；连点守卫。
  const [cheersFx, setCheersFx] = useState<{ id: string; key: number } | null>(
    null,
  );
  function handleCheers(id: string): void {
    // MOCK — local state only. EPIC 3 sends a real cheers via Supabase.
    // UR3.2 限额守卫：满 15 即拦（按钮同 disabled，双保险）。
    if (
      sentIdsRef.current.includes(id) ||
      cheersFx !== null ||
      !canCheers(sentIdsRef.current)
    ) {
      return;
    }
    buzz(BUZZ_CHEERS);
    setCheersFx({ id, key: Date.now() });
  }
  useEffect(() => {
    if (cheersFx === null) return;
    const fx = cheersFx;
    const timer = window.setTimeout(() => {
      // MOCK optimistic commit — EPIC 3.0 写 cheers 双边行（见 future-schema）。
      const next = sentIdsRef.current.includes(fx.id)
        ? sentIdsRef.current
        : [...sentIdsRef.current, fx.id];
      sentIdsRef.current = next;
      setSentIds(next);
      saveSentToday(next, new Date());
      setCheersFx(null);
    }, CHEERS_FX_MS);
    return () => window.clearTimeout(timer);
  }, [cheersFx]);

  // UR3.3 卡内邀约四态（mock）：idle→sent（3s 等对方）→accepted／declined
  //（按该人 declinesInvite 剧本，Mandy 婉拒其余接受）。真后端由对方点按钮，
  // effect 定时整段删，换 realtime 回调。
  type InvitePhase = "sent" | "accepted" | "declined";
  const [inviteFx, setInviteFx] = useState<{ id: string } | null>(null);
  const [invites, setInvites] = useState<Partial<Record<string, InvitePhase>>>(
    {},
  );
  function handleInvite(id: string): void {
    const c = MOCK_CHECKINS.find((m) => m.id === id);
    if (
      c === undefined ||
      !isOnline(c, nowMs) ||
      invites[id] === "sent" ||
      invites[id] === "accepted" ||
      inviteFx !== null
    ) {
      return;
    }
    setInviteFx({ id });
  }
  useEffect(() => {
    if (inviteFx === null) return;
    const fx = inviteFx;
    const timer = window.setTimeout(() => {
      const c = MOCK_CHECKINS.find((m) => m.id === fx.id);
      const phase: InvitePhase =
        c?.declinesInvite === true ? "declined" : "accepted";
      if (phase === "accepted") buzz(BUZZ_FOUND);
      setInvites((prev) => ({ ...prev, [fx.id]: phase }));
      setInviteFx(null);
    }, INVITE_MOCK_MS);
    return () => window.clearTimeout(timer);
  }, [inviteFx]);

  // UR3.4 足迹模式（返工后口径）：足迹＝我自己的打卡（现在只有当前
  // 想喝钉，以后是列表）。同图叠层：聚光圈＋永久酒名签，他人层走 CSS
  // 置灰（wtd-others＋trailDim）；2 站以上才连虚线（现在走不到，留给以后）。
  const [trailMode, setTrailMode] = useState(false);
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || map === null || L === null) return;
    trailLayerRef.current?.remove();
    trailLayerRef.current = null;
    if (!trailMode) return;
    const stops = trailStops(wantHistory);
    if (stops.length === 0) return;
    const ink =
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--doodle-red")
        .trim() || "#b3261e";
    const pts = stops.map(
      (s) => [s.position.lat, s.position.lng] as [number, number],
    );
    const layer = L.layerGroup();
    if (pts.length > 1) {
      L.polyline(pts, {
        color: ink,
        weight: 3,
        dashArray: "2 7",
        lineCap: "round",
      }).addTo(layer);
    }
    stops.forEach((s, i) => {
      // 我的钉本体已在图上（想喝钉），这里只加聚光圈＋酒名签。
      const halo = L.circle([s.position.lat, s.position.lng], {
        radius: 150,
        color: ink,
        weight: 3,
        dashArray: "6 6",
        fill: false,
      });
      halo.bindTooltip(
        pts.length > 1 ? `${i + 1} · ${s.beerName}` : s.beerName,
        {
          permanent: true,
          direction: "top",
          offset: [0, -20],
          className: styles.trailTip,
        },
      );
      halo.addTo(layer);
    });
    layer.addTo(map);
    trailLayerRef.current = layer;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (pts.length === 1) {
      const at = pts[0] as [number, number];
      if (reduced) map.setView(at, Math.max(map.getZoom(), 15));
      else map.flyTo(at, Math.max(map.getZoom(), 15), { duration: 1 });
    } else if (reduced) map.fitBounds(pts, { padding: [40, 40], animate: false });
    else map.flyToBounds(pts, { padding: [40, 40], duration: 1 });
    return () => {
      layer.remove();
      if (trailLayerRef.current === layer) trailLayerRef.current = null;
    };
  }, [trailMode, mapReady, wantHistory]);

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
      className={`${styles.frame} relative overflow-hidden rounded-2xl border-2 bg-card shadow-[4px_4px_0_var(--border)] ${
        trailMode ? styles.trailDim : ""
      }`}
    >
      <div
        ref={holderRef}
        // UR1.3 immersive mobile: header (3.5rem) + section pt-3 (0.75rem)
        // above, map fills the rest of the first viewport. Desktop unchanged.
        className="h-[calc(100svh-4.25rem)] w-full md:h-[560px]"
        role="application"
        aria-label={t("mapLabel")}
      />

      {/* UR3.5 左上城市状态卡（顶双 pill 已删，此处是唯一的顶卡）：
          城市大字＋登录状态＋上次在线＋条件上次地点，图形 tile 复 tile 行。 */}
      <div
        className={`${styles.above} absolute top-3 left-3 flex items-center gap-2.5 rounded-2xl border-2 bg-card/95 py-2 pr-3 pl-2 shadow-[3px_3px_0_var(--border)] backdrop-blur-sm`}
      >
        <span
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 bg-accent text-accent-foreground"
        >
          <CityIcon code={cityCode} size={54} />
        </span>
        <span className="min-w-0">
          <span className="font-hand block text-xl leading-none font-bold">
            {t(cityLabelKey)}
          </span>
          <span
            className={`mt-1 flex items-center gap-1 text-xs font-bold ${meStatusTone}`}
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-current"
            />
            {meStatusText}
          </span>
          {lastVisit !== null && (
            <span className="text-muted-foreground mt-0.5 block text-xs">
              {t("lastSeenAt", {
                time: formatWantTime(lastVisit.at, locale),
              })}
            </span>
          )}
          {shouldShowLastPlace(lastVisit, currentArea) && (
            <span className="text-muted-foreground block max-w-36 truncate text-xs">
              {t("lastPlaceAt", { place: lastVisit?.area ?? "" })}
            </span>
          )}
        </span>
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
          {pickLanes ? (
            // UR3.9 v2 L1 品種輪詢：橫向 snap 卡（代表酒手繪大圖＋膠帶貼紙，
            // 點卡進 L2 看整批，角落＋鈕是該類直接想喝）。
            <div className="mt-3">
              <p className="text-muted-foreground text-sm">
                {t("pickCategoriesTitle")}
              </p>
              <div className="mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {BEER_CATEGORIES.map((lane, i) => {
                  const laneBeers = beersInCategory(lane.id);
                  const artBeer =
                    laneBeers.find((b) => iconForPickId(b.id) !== null) ??
                    laneBeers[0];
                  const Art =
                    artBeer === undefined
                      ? null
                      : iconForPickId(artBeer.id);
                  return (
                    <div
                      key={lane.id}
                      style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                      className={`${styles.laneIn} relative w-36 shrink-0 snap-center rounded-2xl border-2 bg-card pt-4 shadow-[2px_2px_0_var(--border)] ${
                        i % 2 === 0 ? "-rotate-1" : "rotate-1"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`${styles.tape} absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 -rotate-3`}
                      />
                      <button
                        type="button"
                        onClick={() => handlePickLane(lane.id)}
                        className="flex w-full flex-col items-center gap-1 px-2 pb-2"
                      >
                        {Art !== null ? (
                          <span className="block h-24 w-auto shrink-0 [&>svg]:h-24 [&>svg]:w-auto">
                            <Art />
                          </span>
                        ) : (
                          <span className="text-5xl" aria-hidden>
                            {lane.emoji}
                          </span>
                        )}
                        <span className="font-hand text-base leading-tight font-bold">
                          {t(lane.labelKey)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {t("laneCount", { n: laneBeers.length })}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLaneWant(lane.id)}
                        aria-label={t("pickDirectWant", {
                          cat: t(lane.labelKey),
                        })}
                        title={t("pickDirectWant", { cat: t(lane.labelKey) })}
                        className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 bg-accent text-accent-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                      >
                        <Plus size={14} aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : picked === null ? (
            <button
              type="button"
              onClick={() => setPickLanes(true)}
              className="font-hand mt-3 inline-flex items-center gap-2 rounded-full border-2 bg-primary px-4 py-2 text-base font-bold text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <Dices size={18} aria-hidden />
              {t("pickCta")}
            </button>
          ) : (
            // UR3.9 v3 照片輪詢：一次一主角（peek 下一張），滑動／箭頭／點點
            // 切換，點卡即想喝，無單獨想喝鈕。
            <div className="mt-3">
              {(() => {
                const lane =
                  BEER_CATEGORIES.find((c) => c.id === pickLaneId) ??
                  (pickBatch[0] !== undefined
                    ? categoryOfBeer(pickBatch[0])
                    : null);
                return lane === null ? null : (
                  <p className="text-muted-foreground truncate text-xs">
                    {lane.emoji} {t(lane.labelKey)}
                  </p>
                );
              })()}
              <div
                key={pickBatch.map((b) => b.id).join(",")}
                ref={batchStripRef}
                onScroll={handleBatchScroll}
                className={`${styles.batchIn} mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
              >
                {pickBatch.map((beer, i) => {
                  const Icon = iconForPickId(beer.id);
                  return (
                    <button
                      key={beer.id}
                      data-batch-card=""
                      type="button"
                      onClick={() => handleBatchWant(beer)}
                      aria-label={`${i + 1}/${pickBatch.length} ${beer.name}`}
                      className={`relative flex w-[78%] shrink-0 snap-center flex-col items-center gap-1 rounded-2xl border-2 bg-card p-3 pt-4 shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                        i % 2 === 0 ? "-rotate-1" : "rotate-1"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`${styles.tape} absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-2`}
                      />
                      {Icon !== null ? (
                        <span className="block h-36 w-auto shrink-0 [&>svg]:h-36 [&>svg]:w-auto">
                          <Icon />
                        </span>
                      ) : (
                        <span className="text-6xl" aria-hidden>
                          {beer.emoji}
                        </span>
                      )}
                      <span className="font-hand w-full truncate text-center text-lg leading-tight font-bold">
                        {beer.name}
                      </span>
                      <span className="text-muted-foreground w-full truncate text-center text-xs">
                        {beer.tagline}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => scrollBatch(-1)}
                  aria-label={t("pickPrev")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  <ChevronLeft size={15} aria-hidden />
                </button>
                <div
                  className="flex items-center gap-1.5"
                  aria-hidden
                >
                  {pickBatch.map((beer, i) => (
                    <span
                      key={beer.id}
                      className={`h-1.5 rounded-full transition-all ${
                        i ===
                        Math.max(0, Math.min(batchIndex, pickBatch.length - 1))
                          ? "w-4 bg-primary"
                          : "w-1.5 bg-(--border)"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => scrollBatch(1)}
                  aria-label={t("pickNext")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  <ChevronRight size={15} aria-hidden />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleRefreshBatch}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  <RefreshCw size={15} aria-hidden />
                  {t("pickNextBatch")}
                </button>
                <button
                  type="button"
                  onClick={() => setPickLanes(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  <ChevronLeft size={15} aria-hidden />
                  {t("pickChangeCategory")}
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

      {/* UR3.1 晃杯时刻：毛玻璃罩盖全图（背后地图可见，pointer-events
          关死不挡操作），大杯左右猛晃＋速度线＋飞沫＋小字，
          1250ms 后卸载并聚焦。reduced-motion 下不渲染。 */}
      {shakeSearch !== null && (
        <div
          key={shakeSearch.key}
          aria-hidden
          className={`${styles.above} pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/40 backdrop-blur-sm`}
        >
          {/* 杯体慢晃（内层转），溢泡贴杯口淌（外层不转，顺重力往下），
              两层分离才像液体在动。 */}
          <span className="relative block w-40 shrink-0">
            <span className={`${styles.shakeMug} block`}>
              <BeerMugDoodle cheersLabel="…" />
            </span>
            <span
              className={`${styles.shakeSpill} ${styles.shakeSpillL} absolute top-[6%] left-[13%] h-4 w-4 rounded-full`}
            />
            <span
              className={`${styles.shakeSpill} ${styles.shakeSpillR} absolute top-[6%] right-[13%] h-3.5 w-3.5 rounded-full`}
            />
            <span
              className={`${styles.shakeSpill} ${styles.shakeSpillC} absolute top-[2%] left-1/2 h-5 w-5 rounded-full`}
            />
          </span>
          <p className="font-hand text-xl font-bold">{t("shakeSearching")}</p>
        </div>
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
        onPick={openPickSheet}
        onPhoto={() => router.push("/camera")}
        onRecenter={handleRecenter}
        onFitHk={handleFitHk}
        onZoomIn={() => handleZoom(1)}
        onZoomOut={() => handleZoom(-1)}
        onShake={handleShakeRequest}
        shakeBurst={shakeBurst}
        onFootprints={() => setTrailMode((v) => !v)}
      />


      {/* UR3.4 足迹模式浮条：标题＋显式返回（toggle 同动作可退）；
          空足迹（真后端）给空文案＋去记录 CTA，mock 恒有站只走主分支。 */}
      {trailMode &&
        (() => {
          // 足迹站＝我自己的打卡史（无则空态）。
          const stops = trailStops(wantHistory);
          return (
        <div
          className={`${styles.above} absolute top-3 left-1/2 flex w-max max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-full border-2 bg-card/95 py-1 pr-1 pl-4 shadow-[3px_3px_0_var(--border)]`}
        >
          <p className="font-hand text-base font-bold whitespace-nowrap">
            {stops.length === 0
              ? t("trailEmpty")
              : t("trailTitle", { n: stops.length })}
          </p>
          {stops.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setTrailMode(false);
                openPickSheet();
              }}
              className="font-hand rounded-full border-2 bg-primary px-3 py-1 text-sm font-bold text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              {t("pickCta")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setTrailMode(false)}
              className="font-hand rounded-full border-2 bg-card px-3 py-1 text-sm font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              {t("trailBack")}
            </button>
          )}
        </div>
          );
        })()}

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
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <X size={16} aria-hidden />
          </button>
          {/* UR3.9 v3 內層滾動兜底：卡再高也不頂出地圖下緣（外層量高＋錨定，
              內層超高時自己滾；X 貼紙與尾巴留在外層不動）。 */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: Math.max(160, (view?.ch ?? 600) - 24 - 32) }}
          >
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
                {/* UR3.7 编辑行（UR3.9 v2 换酒改批次自选）：换酒钮只展開同类
                    候选批，点格即换；删除沿两段确认，武装只认正在看的 at。 */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSwapToggle}
                    className="font-hand inline-flex items-center gap-1.5 rounded-full border-2 bg-card px-3 py-1 text-sm font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    <Dices size={15} aria-hidden />
                    {t("swapBeer")}
                  </button>
                  {confirmAt === wantRecord.at ? (
                    <button
                      type="button"
                      onClick={handleDeleteWant}
                      className="font-hand inline-flex items-center gap-1.5 rounded-full border-2 border-red-700 bg-card px-3 py-1 text-sm font-bold text-red-700 shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border-red-400 dark:text-red-400"
                    >
                      <Trash2 size={15} aria-hidden />
                      {t("confirmDelete")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAt(wantRecord.at)}
                      className="font-hand text-muted-foreground inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                      <Trash2 size={15} aria-hidden />
                      {t("deleteEntry")}
                    </button>
                  )}
                </div>
                {swapOpenFor === wantRecord.at && (
                  <div key={swapBatch.map((b) => b.id).join(",")} className={`${styles.batchIn} mt-3`}>
                    <div className="grid grid-cols-3 gap-2">
                      {swapBatch.map((beer) => {
                        const Icon = iconForPickId(beer.id);
                        return (
                          <button
                            key={beer.id}
                            type="button"
                            onClick={() => handleSwapTo(beer)}
                            className="flex flex-col items-center gap-1 rounded-2xl border-2 bg-card p-2 shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                          >
                            {Icon !== null ? (
                              <span className="block h-16 w-auto shrink-0 [&>svg]:h-16 [&>svg]:w-auto">
                                <Icon />
                              </span>
                            ) : (
                              <span className="text-3xl" aria-hidden>
                                {beer.emoji}
                              </span>
                            )}
                            <span className="w-full truncate text-center text-xs font-bold">
                              {beer.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={handleSwapRefresh}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                    >
                      <RefreshCw size={15} aria-hidden />
                      {t("pickNextBatch")}
                    </button>
                  </div>
                )}
              </div>
            ) : null
          ) : (
            <>
              {/* UR2.7 追加同构 hero 槽：酒名命中已画品牌 → 设计稿放主角位
                  （头像缩成角标保身份）；没命中保持原放大头像，不硬凑。 */}
              {/* UR3.6 他人卡头：水彩 blob＋胶带贴纸裱头像；
                  右侧 pr-10 给 X 贴纸让位＋全区 flex-wrap，在线态下沉到
                  meta 行——结构上不再有东西能顶进 X 底下。 */}
              <div className="flex items-center gap-4">
                {(() => {
                  const DrinkIcon = iconForDrinkName(card.drinkName);
                  // UR3.3 在线绿点：头像（或角标）右下角，和 pin 同款。
                  const online = isOnline(card, nowMs);
                  const onlineDot = online ? (
                    <span aria-hidden className={styles.pinOnline} />
                  ) : null;
                  const tape = (
                    <span
                      aria-hidden
                      className={`${styles.tape} absolute -top-2 left-1/2 z-10 h-5 w-12 -translate-x-1/2 -rotate-6 rounded-[2px]`}
                    />
                  );
                  const wash = (
                    <span
                      aria-hidden
                      className={`${styles.waterWash} absolute -inset-2`}
                    />
                  );
                  return DrinkIcon !== null ? (
                    <span className="relative shrink-0">
                      {wash}
                      {tape}
                      <span
                        className={`${styles.pickArtIn} relative block h-24 w-auto [&>svg]:h-full [&>svg]:w-auto`}
                      >
                        <DrinkIcon />
                      </span>
                      <span
                        className="absolute -right-2 -bottom-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 bg-card text-xl"
                        aria-hidden
                      >
                        {card.avatarEmoji}
                        {onlineDot}
                      </span>
                    </span>
                  ) : (
                    <span className="relative shrink-0">
                      {wash}
                      {tape}
                      <span
                        className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-card text-3xl"
                        aria-hidden
                      >
                        {card.avatarEmoji}
                        {onlineDot}
                      </span>
                    </span>
                  );
                })()}
                <div className="min-w-0 pr-10">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {card.nickname}
                    {/* UR2.0 他人性别标记（mock 数据，见 lib/checkins.ts） */}
                    <span className="font-hand rounded-full border-2 bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                      {t(GENDER_KEY[card.gender])}
                    </span>
                  </p>
                  {/* meta 行：区名·距离·在线全收敛到这一行自由换行，
                      上方名字行＋本行都有 pr-10，X 再也压不到字。 */}
                  <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
                    <span>{card.area}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {selfFix !== null
                        ? t("distanceAway", {
                            d: formatDistance(
                              haversineMeters(selfFix, card.position),
                            ),
                          })
                        : t("needLocateForDistance")}
                    </span>
                    {isOnline(card, nowMs) && (
                      <span
                        className={`${styles.inviteOk} inline-flex items-center gap-1 font-bold`}
                      >
                        <span
                          aria-hidden
                          className={`${styles.onlineDot} inline-block h-2 w-2 rounded-full`}
                        />
                        {t("onlineNow")}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {card.drinkEmoji}{" "}
                    {t("drinking", { drink: card.drinkName })}
                  </p>
                </div>
              </div>
              {/* UR3.6 手绘波浪分隔线：信息区和动作区的纸上分界。 */}
              <svg
                aria-hidden
                viewBox="0 0 120 8"
                className="mt-3 w-full"
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
                strokeLinecap="round"
                preserveAspectRatio="none"
              >
                <path d="M2 5 Q10 1 18 5 T34 5 T50 5 T66 5 T82 5 T98 5 T118 5" />
              </svg>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  {t("cheersCount", {
                    // MOCK 乐观＋1：碰杯（特效中）即算数，EPIC 3.0 以 count 为准。
                    n:
                      card.cheers +
                      (sentIds.includes(card.id) ||
                      cheersFx?.id === card.id
                        ? 1
                        : 0),
                  })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {sentIds.includes(card.id) ? (
                    <p role="status" className="font-hand text-lg font-bold">
                      {t("cheersSent")}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCheers(card.id)}
                      disabled={cheersFx !== null || !canCheers(sentIds)}
                      className="font-hand inline-flex items-center gap-1.5 rounded-full border-2 bg-primary px-4 py-1.5 font-bold text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                    >
                      {t("cheers")}
                    </button>
                  )}
                  {/* UR3.3 约喝酒（副按钮，白底 ink 边）：只给在线人挂；
                      乾杯是主按钮，两者独立，互不锁。
                      UR3.6 副钮降级（px-3 py-1 text-sm）：和主钮拉开层级，
                      治“畸形大”；外层已 flex-wrap，窄卡自动另起一行。 */}
                  {isOnline(card, nowMs) &&
                    (() => {
                      const phase = invites[card.id];
                      const pending = inviteFx?.id === card.id;
                      if (phase === "accepted") {
                        return (
                          <p
                            role="status"
                            className={`${styles.inviteOk} font-hand text-lg font-bold`}
                          >
                            {t("inviteAccepted")}
                          </p>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => handleInvite(card.id)}
                          disabled={pending}
                          className="font-hand inline-flex items-center gap-1.5 rounded-full border-2 bg-card px-3 py-1 text-sm font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                        >
                          {pending ? (
                            <>
                              {t("inviteSent")}
                              <span
                                aria-hidden
                                className={styles.inviteDots}
                              >
                                …
                              </span>
                            </>
                          ) : (
                            t("inviteCta")
                          )}
                        </button>
                      );
                    })()}
                </div>
              </div>
              {/* UR3.3 邀约结果条：成局 accent 条＋成功震（effect 里已 buzz），
                  婉拒灰条＋按钮恢复可再约（上行回到 idle）。 */}
              {invites[card.id] === "accepted" && (
                <p
                  key={`${card.id}-accepted`}
                  role="status"
                  className={`${styles.inviteDone} font-hand mt-2 rounded-xl border-2 bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground`}
                >
                  {t("inviteAcceptedDetail", { area: card.area })}
                </p>
              )}
              {invites[card.id] === "declined" && (
                <p
                  key={`${card.id}-declined`}
                  role="status"
                  className={`${styles.inviteDone} text-muted-foreground mt-2 text-sm`}
                >
                  {t("inviteDeclined")}
                </p>
              )}
              {/* UR3.2 每日额度：剩余额常显（mock 跨天，localStorage），
                  用完变满额句＋按钮 disabled，handleCheers 内同守卫。 */}
              <p className="text-muted-foreground mt-1 text-xs">
                {canCheers(sentIds)
                  ? t("cheersLeft", { n: cheersRemaining(sentIds) })
                  : t("cheersLimitReached")}
              </p>
              {/* UR3.0 碰杯特效层：卡内绝对覆盖（面板即定位祖先），播完自动拆。
                  两杯摆入碰杯＋冲击环＋泡沫粒＋大字，纯 transform／opacity；
                  reduced-motion 下不渲染，直接收据。 */}
              {cheersFx !== null &&
                cheersFx.id === card.id &&
                !reducedMotion && (
                  <div
                    key={cheersFx.key}
                    aria-hidden
                    className={`${styles.cheersFx} pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl bg-card/70`}
                  >
                    <span className={`${styles.cheersMugL} w-28 shrink-0`}>
                      <BeerMugDoodle cheersLabel="!" />
                    </span>
                    {/* 手绘星形冲击＋速度线：碰杯那一下的“哐”。 */}
                    <svg
                      viewBox="0 0 100 100"
                      className={`${styles.cheersStar} absolute w-28`}
                    >
                      <polygon
                        points="50,4 60,33 93,30 68,52 80,86 50,66 22,88 31,53 6,33 40,36"
                        fill="var(--mustard-soft)"
                        stroke="var(--border)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <svg
                      viewBox="0 0 120 60"
                      className={`${styles.cheersLines} absolute w-44`}
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <path d="M 4 10 L 34 22" />
                      <path d="M 2 30 L 36 30" />
                      <path d="M 4 50 L 34 38" />
                      <path d="M 116 10 L 86 22" />
                      <path d="M 118 30 L 84 30" />
                      <path d="M 116 50 L 86 38" />
                    </svg>
                    <span className={`${styles.cheersBurst} absolute`} />
                    <span
                      className={`${styles.cheersFoam} ${styles.cheersF1} absolute h-2.5 w-2.5 rounded-full`}
                    />
                    <span
                      className={`${styles.cheersFoam} ${styles.cheersF2} absolute h-2 w-2 rounded-full`}
                    />
                    <span
                      className={`${styles.cheersFoam} ${styles.cheersF3} absolute h-3 w-3 rounded-full`}
                    />
                    <span
                      className={`${styles.cheersFoam} ${styles.cheersF4} absolute h-2 w-2 rounded-full`}
                    />
                    <span
                      className={`${styles.cheersFoam} ${styles.cheersF5} absolute h-2.5 w-2.5 rounded-full`}
                    />
                    <span className={`${styles.cheersMugR} w-28 shrink-0`}>
                      <BeerMugDoodle cheersLabel="!" />
                    </span>
                    <span
                      className={`${styles.cheersLabel} font-hand absolute text-5xl font-bold`}
                    >
                      {t("cheers")}
                    </span>
                  </div>
                )}
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

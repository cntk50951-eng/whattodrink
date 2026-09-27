"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type * as Leaflet from "leaflet";

import {
  DEFAULT_CENTER,
  HK_BOUNDS,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import {
  parseMapProvider,
  shouldFallbackToOsm,
  tileSpecFor,
} from "@/lib/maps/provider";
import { avoidLive, planSpread } from "@/lib/mapSpread";
import {
  ANCHOR_ZOOM_MAX,
  groupByAnchor,
  groupByCity,
  groupByCountry,
} from "@/lib/geoAreas";
import type { BeerIconComponent } from "@/components/marketing/beer-icons/wall";
import { iconForDrinkName } from "@/components/marketing/beer-icons/wall";
import type { V2Marker } from "./v2Pins";
import styles from "./v2.module.css";

export type V2WantMarker = {
  id: string;
  lat: number;
  lng: number;
  emoji: string;
  /** UR C.4：品牌圖 URL（有則釘上顯示品牌圖，無則琥珀底 emoji 回退）。 */
  iconUrl: string | null;
  /** UR A.20：本地 SVG 組件（有則 createRoot 注入優先於 img／emoji）。 */
  Icon: BeerIconComponent | null;
};

export type V2TrailMarker = {
  id: string;
  lat: number;
  lng: number;
  n: number;
  /** UR C.11 round-6：打卡時間 epoch ms（組內最新為向，腳印方向即時間方向）。 */
  at: number;
};

export type V2MapApi = {
  recenter: () => void;
  fitHk: () => void;
  /** UR C.11：一鍵足跡——飛到剛好裝下給定點（沿 C.9 fitMembers 口徑）。 */
  fitPoints: (points: LatLng[]) => void;
  flyTo: (at: LatLng, zoom?: number) => void;
  getCenter: () => LatLng | null;
  /** UR C.14 round-2：堆疊列表一鍵散開（復用 C.6 地理圓周散 pin，父層關 Sheet 後調）。 */
  spreadStack: (ids: string[]) => void;
};

/** UR A.21 好友實時釘模型（父層 `useLiveFriends` 直供；server 已過濾）。 */
export type V2FriendMarker = {
  /** users.id（server 回顯原樣，點擊原樣交回）。 */
  id: string;
  lat: number;
  lng: number;
  /** 暱稱首字（父層切好，模塊不碰字符串）。 */
  label: string;
};

/** UR A.21 自釘呈現：匿名沿舊藍，在線綠，隱身灰（fail-closed 未知態走灰）。 */
export type SelfPresence = "online" | "stealth" | "anon";

type V2MapViewProps = {
  others: V2Marker[];
  wants: V2WantMarker[];
  trail: V2TrailMarker[] | null;
  self: LatLng | null;
  onPinClick: (id: string) => void;
  onWantClick: (id: string) => void;
  /** UR C.11：地圖 ready 回調（父層等 ready 才飛全軌跡，不輪詢）。 */
  onReady?: () => void;
  /** UR C.11 round-7：點地圖本體（父層清足跡；pin 上點不觸發，見 init 守衛）。 */
  onMapTap?: () => void;
  presence: SelfPresence;
  friends: V2FriendMarker[];
  onFriendClick: (id: string) => void;
  /** UR C.14 round-2：+N 堆疊徽點擊（成員 id 含代表，父層開列表 Sheet）。 */
  onStackClick?: (ids: string[]) => void;
};

/** HTML 转义（divIcon  innerHTML 拼昵称首字用，用户内容不可信）。 */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 屬性轉義（esc 再加引號；URL 另限 http(s)  scheme，見下）。 */
function escAttr(s: string): string {
  return esc(s).replace(/"/g, "&quot;");
}

/**
 * UR C.6 round-7 他人釘面：本地品牌圖優先（調用方收進 pendingArt 注入），
 * 無圖退酒 emoji，再退首字（沿舊觀感）。V2Marker 自帶 drink 兩字段，免查表。
 */
function otherPinContent(m: V2Marker): { html: string; Icon: BeerIconComponent | null } {
  const dot = m.online ? `<span class="${styles.v2pinOnline}"></span>` : "";
  const Icon = m.drink !== null ? iconForDrinkName(m.drink) : null;
  if (Icon !== null) {
    return {
      html: `<div class="${styles.v2pin}"><span data-art="1"></span>${dot}</div>`,
      Icon,
    };
  }
  return {
    html: `<div class="${styles.v2pin}">${esc(m.drinkEmoji ?? m.label)}${dot}</div>`,
    Icon: null,
  };
}

/**
 * DEF-20260926-015 確診根因：`root.unmount()` 跑在別樹渲染提交途中，
 * React 即報 race（同步 unmount 禁在渲染期）。改 microtask 延後一拍，
 * 圖層 DOM 已同步摘除（`layer.remove()` 照舊），只晚清 React 內部態；
 * 併發重建導致的重複卸載用 try/catch 吞掉。純函數（數組＋定時，無 JSX）。
 */
function unmountRootsAsync(roots: Root[]): void {
  if (roots.length === 0) return;
  queueMicrotask(() => {
    for (const r of roots) {
      try {
        r.unmount();
      } catch {
        // 已卸載或併發清理過——DOM 早摘，無事可做
      }
    }
  });
}

/**
 * UR C.1 v2 地圖：Leaflet 原生 skin（零 doodle 濾鏡／紙紋），標準圓釘。
 * 共用層複用（geo 常數＋mapSpread）；markers 按 props 重建；
 * 操作經 ref 暴露（父層按鈕調）。 reduced-motion 讀掛載時一次。
 */
export const V2MapView = forwardRef<V2MapApi, V2MapViewProps>(function V2MapView(
  { others, wants, trail, self, onPinClick, onWantClick, onReady, onMapTap, presence, friends, onFriendClick, onStackClick },
  ref,
) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  // UR A.20：divIcon 是 HTML 字串，本地 SVG 組件用 createRoot 注入佔位槽；
  // 圖層重建／卸載時逐個 unmount（render 內不許寫 ref，只在 effect 內動）。
  const artRoots = useRef<Root[]>([]);
  useEffect(() => {
    return () => {
      const cur = artRoots.current;
      artRoots.current = [];
      unmountRootsAsync(cur);
    };
  }, []);
  // UR C.6 round-5 同點散 pin（round-3 回歸）：被选中的簇成员 id，
  // 地理真 pin 摆开显示。切簇即換，點空地／數據失配即清。
  const [spreadIds, setSpreadIds] = useState<string[] | null>(null);
  // 回調 ref 化（marker 點擊閉包讀最新，不重建圖層樹；render 內不許寫 ref）。
  const cbRef = useRef({ onPinClick, onWantClick, onReady, onMapTap, onFriendClick, onStackClick });
  useEffect(() => {
    cbRef.current = { onPinClick, onWantClick, onReady, onMapTap, onFriendClick, onStackClick };
  });
  // UR A.21 好友常駐層（獨立於主 layer 重建；marker 複用＋setLatLng，
  // CSS 位移過渡即平滑跟隨，不拆層不閃爍）。
  const friendLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const friendMarksRef = useRef(new Map<string, Leaflet.Marker>());
  // UR C.13 足跡腳印常駐層（獨立於主 layer，關 Sheet 不重建，仿 friendLayer）
  const footLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const footMarksRef = useRef(new Map<string, Leaflet.Marker>());
  const movingMarkerRef = useRef<Leaflet.Marker | null>(null);
  const movingRightRef = useRef<Leaflet.Marker | null>(null);
  const animRef = useRef<number | null>(null);
  const polylineRef = useRef<Leaflet.Polyline | null>(null);
  // 常駐層只生死於掛載／卸載（init 的 map.remove() 另管圖本體，互不干擾）。
  useEffect(() => {
    return () => {
      friendLayerRef.current?.remove();
      friendLayerRef.current = null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      friendMarksRef.current.clear();
      footLayerRef.current?.remove();
      footLayerRef.current = null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      footMarksRef.current.clear();
      if (movingMarkerRef.current !== null) {
        movingMarkerRef.current.remove();
        movingMarkerRef.current = null;
      }
      if (movingRightRef.current !== null) {
        movingRightRef.current.remove();
        movingRightRef.current = null;
      }
      if (polylineRef.current !== null) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, []);
  // init 是異步 import：ready 前 markers effect 直接返回，ready 後重跑一次
  const [mapReady, setMapReady] = useState(false);
  // UR C.6 round-6：縮放結束重算聚合（簇是像素概念，不跟 zoom 簇永遠不散；
  // 舊版 markers 只跟數據，zoom 到頂徽還在——這才是「一直放大也看不到」的根因）。
  const [zoomTick, setZoomTick] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      recenter() {
        const map = mapRef.current;
        if (map === null) return;
        if (self !== null) {
          map.flyTo([self.lat, self.lng], Math.max(map.getZoom(), 15), {
            duration: 0.8,
          });
        } else {
          map.flyTo(
            [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
            ZOOM_DEFAULT,
            { duration: 0.8 },
          );
        }
      },
      fitHk() {
        mapRef.current?.fitBounds(
          [
            [HK_BOUNDS.south, HK_BOUNDS.west],
            [HK_BOUNDS.north, HK_BOUNDS.east],
          ],
          { padding: [24, 24] },
        );
      },
      fitPoints(points: LatLng[]) {
        const map = mapRef.current;
        const L = leafletRef.current;
        if (map === null || L === null || points.length === 0) return;
        const bounds = L.latLngBounds(
          points.map((p) => [p.lat, p.lng] as [number, number]),
        );
        if (!bounds.isValid()) return;
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        if (sw.equals(ne)) {
          bounds.extend([sw.lat - 0.0015, sw.lng - 0.0015]);
          bounds.extend([ne.lat + 0.0015, ne.lng + 0.0015]);
        }
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        map.fitBounds(bounds, {
          padding: [56, 56],
          maxZoom: ZOOM_MAX,
          animate: !reduced,
        });
      },
      flyTo(at: LatLng, zoom?: number) {
        const map = mapRef.current;
        if (map === null) return;
        map.flyTo([at.lat, at.lng], zoom ?? Math.max(map.getZoom(), 14), {
          duration: 0.8,
        });
      },
      getCenter() {
        const map = mapRef.current;
        if (map === null) return null;
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng };
      },
      spreadStack(ids: string[]) {
        // 堆疊列表「在地圖上散開」：復用 C.6 地理圓周散 pin（關 Sheet 後調）。
        setSpreadIds(ids.length > 0 ? [...ids] : null);
      },
    }),
    [self],
  );
  // init once ＋ dispose（StrictMode double-mount 可重入）
  useEffect(() => {
    const holder = holderRef.current;
    if (holder === null || holder.dataset.ready === "1") return;
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    void import("leaflet").then((L) => {
      if (cancelled || holderRef.current === null) return;
      leafletRef.current = L;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      // created  freeze 非空实例（闭包内直接用；map 留给清理函数置空）。
      const created = L.map(holderRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        minZoom: ZOOM_MIN,
        maxZoom: ZOOM_MAX,
        zoomAnimation: !reduced,
        fadeAnimation: !reduced,
      });
      map = created;
      // UR C.8 试水：底图经 env 开关（缺省 OSM，与之前一致）；
      // 高德瓦片连续失败达阈值自动拆层换 OSM（tileload 成功清零计数）。
      const spec = tileSpecFor(
        parseMapProvider(process.env.NEXT_PUBLIC_MAP_PROVIDER),
      );
      const baseLayer = L.tileLayer(spec.url, {
        attribution: spec.attribution,
        maxZoom: ZOOM_MAX,
        maxNativeZoom: spec.maxNativeZoom,
        ...(spec.subdomains !== undefined
          ? { subdomains: spec.subdomains }
          : {}),
      });
      let consecutiveErrors = 0;
      let fellBack = false;
      baseLayer.on("tileload", () => {
        consecutiveErrors = 0;
      });
      baseLayer.on("tileerror", () => {
        if (fellBack) return;
        consecutiveErrors += 1;
        if (!shouldFallbackToOsm(consecutiveErrors)) return;
        fellBack = true;
        created.removeLayer(baseLayer);
        const osm = tileSpecFor("osm");
        L.tileLayer(osm.url, {
          attribution: osm.attribution,
          maxZoom: ZOOM_MAX,
          maxNativeZoom: osm.maxNativeZoom,
        }).addTo(created);
      });
      baseLayer.addTo(map);
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], ZOOM_DEFAULT);
      // UR C.13 足迹置顶：创建高 zIndex pane，保证脚印在最上层
      try {
        const pane = map.createPane("footPane");
        pane.style.zIndex = "700";
      } catch {
        // 已创建则忽略
      }
      // UR C.6 round-6：縮放結束觸發重建（見 zoomTick）。
      map.on("zoomend", () => {
        setZoomTick((t) => t + 1);
      });
      // UR C.11 round-7：點地圖本體通知父層清足跡（pin 圖標內點擊不透，
      // marker 自有 handler；此處只認地圖本體）。
      map.on("click", (e: Leaflet.LeafletMouseEvent) => {
        const t = e.originalEvent?.target as HTMLElement | null;
        if (
          t !== null &&
          typeof t.closest === "function" &&
          t.closest(".leaflet-marker-icon") !== null
        )
          return;
        cbRef.current.onMapTap?.();
      });
      // 沉浸高地圖下整屏手勢：UR C.12 改 none（沿 module css 同值，重要性保底；
      // C.1 pan-y 配方退役理由見 css 註）。
      holder.style.setProperty("touch-action", "none", "important");
      holder.dataset.ready = "1";
      mapRef.current = map;
      setMapReady(true);
      cbRef.current.onReady?.();
    });
    return () => {
      cancelled = true;
      layerRef.current?.remove();
      map?.remove();
      mapRef.current = null;
      delete holder.dataset.ready;
      setMapReady(false);
    };
  }, []);

  // DEF-012 round-2：轉屏／縮放視口即重算尺寸，否則瓦片錯位（Leaflet 不自適應容器變化）。
  useEffect(() => {
    const onResize = (): void => {
      mapRef.current?.invalidateSize();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // markers 重建（others 聚合＋wants＋trail＋self；等 init ready）
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || map === null || L === null) return;
    layerRef.current?.remove();
    unmountRootsAsync(artRoots.current);
    artRoots.current = [];
    const layer = L.layerGroup();
    // 本地圖注入隊列（他人單釘／散 pin／想喝釘共用；上圖後統一 createRoot）
    const pendingArt: { marker: Leaflet.Marker; Icon: BeerIconComponent }[] = [];

    // UR C.6 round-5：散 pin 名單失配（數據刷新致 id 對不上）同步清，
    // 否則僵尸散 pin 赖着不走（必要同步，沿 BeerIcon 同款註記口徑）。
    const liveSpread =
      spreadIds === null ? null : others.filter((o) => spreadIds.includes(o.id));
    if (spreadIds !== null && (liveSpread === null || liveSpread.length === 0)) {
      setSpreadIds(null);
    }
    const spread =
      liveSpread !== null && liveSpread.length > 0 ? liveSpread : null;
    const spreadSet =
      spread === null ? null : new Set(spread.map((o) => o.id));

    // 他人：層級分組（UR C.9）——z≤11 商圈錨徽（名＋數），以上像素簇沿用。
    // 散 pin 成員不進任何分組（否則徽還在，散了白散）；members 下標認 rest 數組。
    const rest =
      spreadSet === null ? others : others.filter((o) => !spreadSet.has(o.id));
    // UR C.14 round-2：重疊自動散開＋live 避讓（像素空間，zoomTick 重建即重算）。
    // live（自＋友）永不進散開輸入——活人釘死真位，只推啤酒釘。
    const restPx = rest.map((m) => map.latLngToContainerPoint([m.lat, m.lng]));
    const spreadPlan = planSpread(
      rest.map((m, i) => {
        const p = restPx[i] as { x: number; y: number };
        return { id: m.id, x: p.x, y: p.y };
      }),
    );
    const livePx: { x: number; y: number }[] = [];
    if (self !== null) {
      const p = map.latLngToContainerPoint([self.lat, self.lng]);
      livePx.push({ x: p.x, y: p.y });
    }
    for (const f of friends) {
      const p = map.latLngToContainerPoint([f.lat, f.lng]);
      livePx.push({ x: p.x, y: p.y });
    }
    // 避讓輸入用散開後像素（rest 單枚／代表取散開位；wants／trail 取真位）。
    const stackedHidden = new Set(
      spreadPlan.stacks.flatMap((s) => s.memberIds),
    );
    const avoidInput: { id: string; x: number; y: number }[] = [];
    rest.forEach((m, i) => {
      if (stackedHidden.has(m.id)) return;
      const p = restPx[i] as { x: number; y: number };
      const so = spreadPlan.offsets.get(m.id) ?? { dx: 0, dy: 0 };
      avoidInput.push({ id: `o:${m.id}`, x: p.x + so.dx, y: p.y + so.dy });
    });
    for (const w of wants) {
      const p = map.latLngToContainerPoint([w.lat, w.lng]);
      avoidInput.push({ id: `w:${w.id}`, x: p.x, y: p.y });
    }
    if (trail !== null) {
      for (const s of trail) {
        const p = map.latLngToContainerPoint([s.lat, s.lng]);
        avoidInput.push({ id: `t:${s.id}`, x: p.x, y: p.y });
      }
    }
    const avoidMap = avoidLive(avoidInput, livePx, 40);
    // 命名 id 的最終上圖位（散開偏移由调用方另加，避讓偏移在此統一加）。
    const nudge = (key: string, lat: number, lng: number): [number, number] => {
      const o = avoidMap.get(key);
      if (o === undefined) return [lat, lng];
      const p = map.latLngToContainerPoint([lat, lng]);
      const at = map.containerPointToLatLng([p.x + o.dx, p.y + o.dy]);
      return [at.lat, at.lng];
    };
    // 成員 bounds fit（錨徽／簇徽共用；沿 C.6 口徑：padding＋maxZoom＋同點 pad）。
    const fitMembers = (ms: V2Marker[]): void => {
      const latlngs = ms.map((m) => [m.lat, m.lng] as [number, number]);
      const bounds = L.latLngBounds(latlngs);
      if (!bounds.isValid()) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      if (sw.equals(ne)) {
        bounds.extend([sw.lat - 0.0015, sw.lng - 0.0015]);
        bounds.extend([ne.lat + 0.0015, ne.lng + 0.0015]);
      }
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.fitBounds(bounds, {
        padding: [56, 56],
        maxZoom: ZOOM_MAX,
        animate: !reduced,
      });
    };
    const zoom = map.getZoom();
    // UR C.13 足迹模式下只显示自己的打卡和足迹，他人暂时隐藏
    const showOthers = trail === null;
    if (showOthers) {
      if (zoom <= ANCHOR_ZOOM_MAX) {
        for (const g of groupByAnchor(rest)) {
        if (g.members.length === 0) continue;
        const ms = g.members.map((i) => rest[i] as V2Marker);
        const badge = L.marker([g.anchor.lat, g.anchor.lng], {
          title: `${g.anchor.name} ${ms.length}`,
          icon: L.divIcon({
            className: "",
            html: `<div class="${styles.v2area}">${esc(g.anchor.name)}<b>${ms.length}</b></div>`,
            iconSize: [132, 40],
            iconAnchor: [66, 20],
          }),
        });
        // 點錨徽 fit 成員區（zoomend 重算自然降級到街區簇／單枚）。
        badge.on("click", () => {
          fitMembers(ms);
          setSpreadIds(null);
        });
        badge.addTo(layer);
      }
    } else {
      // UR C.14 round-2：碰撞即 Vogel 自動散開（小組直接可點，
      // 免徽→fit→散三段舞）；超 cap 組收 +N 徽（代表留真位），點徽開列表。
      // C.6 spreadIds 地理圓周散 pin 保留，由堆疊列表「在地圖上散開」觸發。
      const stackByKeeper = new Map(
        spreadPlan.stacks.map((s) => [s.keeperId, s] as const),
      );
      rest.forEach((m, i) => {
        if (stackedHidden.has(m.id)) return;
        const stack = stackByKeeper.get(m.id);
        const base = restPx[i] as { x: number; y: number };
        if (stack !== undefined) {
          const total = stack.memberIds.length + 1;
          const [blat, blng] = nudge(`o:${m.id}`, m.lat, m.lng);
          const badge = L.marker([blat, blng], {
            title: `+${total}`,
            icon: L.divIcon({
              className: "",
              html: `<div class="${styles.v2stack}">+${total}</div>`,
              iconSize: [48, 48],
              iconAnchor: [24, 24],
            }),
          });
          badge.on("click", () =>
            cbRef.current.onStackClick?.([m.id, ...stack.memberIds]),
          );
          badge.addTo(layer);
          return;
        }
        const so = spreadPlan.offsets.get(m.id) ?? { dx: 0, dy: 0 };
        const at0 = map.containerPointToLatLng([
          base.x + so.dx,
          base.y + so.dy,
        ]);
        const [lat, lng] = nudge(`o:${m.id}`, at0.lat, at0.lng);
        const content = otherPinContent(m);
        const marker = L.marker([lat, lng], {
          title: m.id,
          icon: L.divIcon({
            className: "",
            html: content.html,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
        });
        if (content.Icon !== null) pendingArt.push({ marker, Icon: content.Icon });
        marker.on("click", () => cbRef.current.onPinClick(m.id));
        marker.addTo(layer);
      });
    } // else: z>11 自動散開（上之錨分支對應）
    } // if (showOthers)

    // UR C.6 round-5 同點散 pin：均分圓周擺開 ~20m（街區 zoom 可分，
    // 位移可忽略）；地理真 pin，點枚開卡照舊，縮放自跟地圖不擾。
    // 足迹模式下不展示他人散 pin
    if (showOthers && spread !== null) {
      const R = 0.00018;
      spread.forEach((m, k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / spread.length;
        const lat = m.lat + Math.sin(a) * R;
        const lng = m.lng + (Math.cos(a) * R) / Math.cos((m.lat * Math.PI) / 180);
        const content = otherPinContent(m);
        const mk = L.marker([lat, lng], {
          title: m.id,
          icon: L.divIcon({
            className: "",
            html: content.html,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
        });
        if (content.Icon !== null) pendingArt.push({ marker: mk, Icon: content.Icon });
        mk.on("click", () => cbRef.current.onPinClick(m.id));
        mk.addTo(layer);
      });
    }

    // 我的想喝釘（UR A.20 本地 SVG 注入優先；無圖沿舊 img／emoji 鏈）
    for (const w of wants) {
      if (w.Icon !== null) {
        const Icon = w.Icon;
        // UR C.14 round-2：想喝釘也避 live（自家想喝常與自釘同點）。
        const [wlat0, wlng0] = nudge(`w:${w.id}`, w.lat, w.lng);
        const marker = L.marker([wlat0, wlng0], {
          icon: L.divIcon({
            className: "",
            html: `<div class="${styles.v2pinWantImg}"><span data-art="1"></span></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
        });
        marker.on("click", () => cbRef.current.onWantClick(w.id));
        marker.addTo(layer);
        pendingArt.push({ marker, Icon });
        continue;
      }
      const img =
        w.iconUrl !== null && /^https?:\/\//.test(w.iconUrl)
          ? `<div class="${styles.v2pinWantImg}"><img src="${escAttr(w.iconUrl)}" alt="" loading="lazy" /></div>`
          : `<div class="${styles.v2pinWant}">${esc(w.emoji)}</div>`;
      const [wlat1, wlng1] = nudge(`w:${w.id}`, w.lat, w.lng);
      const marker = L.marker([wlat1, wlng1], {
        icon: L.divIcon({
          className: "",
          html: img,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      });
      marker.on("click", () => cbRef.current.onWantClick(w.id));
      marker.addTo(layer);
    }

    // 足跡：三级分层（国家>城市>区），仅显示自己，层级决定徽与缩放
    if (trail !== null && trail.length > 0) {
      const numPin = (s: V2TrailMarker): void => {
        // UR C.14 round-2：序號釘撞 live 也讓位（只推酒，不動活人）。
        const [nlat, nlng] = nudge(`t:${s.id}`, s.lat, s.lng);
        L.marker([nlat, nlng], {
          interactive: false,
          icon: L.divIcon({
            className: "",
            html: `<div class="${styles.v2trailNum}">${s.n}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        }).addTo(layer);
      };
      const points = trail.map((p) => ({ lat: p.lat, lng: p.lng }));
      const countryGroups = groupByCountry(points);
      const cityGroups = groupByCity(points);
      const fitMembers = (ms: V2TrailMarker[]): void => {
        const latlngs = ms.map((m) => [m.lat, m.lng] as [number, number]);
        const bounds = L.latLngBounds(latlngs);
        if (!bounds.isValid()) return;
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        if (sw.equals(ne)) {
          bounds.extend([sw.lat - 0.0015, sw.lng - 0.0015]);
          bounds.extend([ne.lat + 0.0015, ne.lng + 0.0015]);
        }
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: ZOOM_MAX, animate: !reduced });
      };
      const cityLabel: Record<string, string> = {
        hk: "香港",
        sz: "深圳",
        gz: "广州",
        sh: "上海",
        bj: "北京",
        other: "其他",
      };
      if (countryGroups.length > 1) {
        for (const g of countryGroups) {
          if (g.members.length === 1) {
            numPin(trail[g.members[0] as number] as V2TrailMarker);
            continue;
          }
          const ms = g.members.map((i) => trail[i] as V2TrailMarker);
          const centerLat = ms.reduce((s, m) => s + m.lat, 0) / ms.length;
          const centerLng = ms.reduce((s, m) => s + m.lng, 0) / ms.length;
          const badge = L.marker([centerLat, centerLng], {
            title: `${g.country} ${ms.length}`,
            icon: L.divIcon({
              className: "",
              html: `<div class="${styles.v2area}">${esc(g.country)}<b>${ms.length}</b></div>`,
              iconSize: [132, 40],
              iconAnchor: [66, 20],
            }),
          });
          badge.on("click", () => fitMembers(ms));
          badge.addTo(layer);
        }
      } else if (cityGroups.length > 1) {
        for (const g of cityGroups) {
          if (g.members.length === 1) {
            numPin(trail[g.members[0] as number] as V2TrailMarker);
            continue;
          }
          const ms = g.members.map((i) => trail[i] as V2TrailMarker);
          const centerLat = ms.reduce((s, m) => s + m.lat, 0) / ms.length;
          const centerLng = ms.reduce((s, m) => s + m.lng, 0) / ms.length;
          const label = cityLabel[g.city] ?? g.city;
          const badge = L.marker([centerLat, centerLng], {
            title: `${label} ${ms.length}`,
            icon: L.divIcon({
              className: "",
              html: `<div class="${styles.v2area}">${esc(label)}<b>${ms.length}</b></div>`,
              iconSize: [132, 40],
              iconAnchor: [66, 20],
            }),
          });
          badge.on("click", () => fitMembers(ms));
          badge.addTo(layer);
        }
      } else if (zoom <= ANCHOR_ZOOM_MAX) {
        for (const g of groupByAnchor(points)) {
          if (g.members.length === 0) continue;
          if (g.members.length === 1) {
            numPin(trail[g.members[0] as number] as V2TrailMarker);
            continue;
          }
          const ms = g.members.map((i) => trail[i] as V2TrailMarker);
          const badge = L.marker([g.anchor.lat, g.anchor.lng], {
            title: `${g.anchor.name} ${ms.length}`,
            icon: L.divIcon({
              className: "",
              html: `<div class="${styles.v2area}">${esc(g.anchor.name)}<b>${ms.length}</b></div>`,
              iconSize: [132, 40],
              iconAnchor: [66, 20],
            }),
          });
          badge.on("click", () => fitMembers(ms));
          badge.addTo(layer);
        }
      } else {
        for (const s of trail) numPin(s);
      }
    }

    // 自己：按呈現態變色（UR A.21：匿名藍／在線綠／隱身灰；呼吸環同色）
    if (self !== null) {
      const selfCls =
        presence === "online"
          ? styles.v2selfOnline
          : presence === "stealth"
            ? styles.v2selfStealth
            : styles.v2self;
      L.marker([self.lat, self.lng], {
        interactive: false,
        // UR C.14：自釘壓頂（z 1000）＋28px 錨點對齊 css 新尺寸
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: "",
          html: `<div class="${selfCls}"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(layer);
    }

    layer.addTo(map);
    layerRef.current = layer;
    // UR A.20：佔位槽已有真 DOM 才可 createRoot（先於 layer 上圖則 getElement 為空）
    for (const { marker, Icon } of pendingArt) {
      const slot = marker.getElement()?.querySelector('span[data-art="1"]');
      if (slot === null || slot === undefined) continue;
      const root = createRoot(slot);
      // size-full：與 BeerImg 同理（將來釘若包進 shadcn 件亦不受 svg reset 影響）
      root.render(<Icon className="size-full" />);
      artRoots.current.push(root);
    }
  }, [mapReady, others, wants, trail, self, presence, friends, spreadIds, zoomTick]);

  // UR A.21 好友常駐層對帳：增量增刪改（marker 複用；setLatLng 配 CSS
  // 位移過渡即跟隨滑行）。主 layer 重建不碰此層；卸載／init 清場由下負責。
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || map === null || L === null) return;
    if (friendLayerRef.current === null) {
      friendLayerRef.current = L.layerGroup().addTo(map);
    }
    const layer = friendLayerRef.current;
    const marks = friendMarksRef.current;
    const seen = new Set<string>();
    for (const f of friends) {
      seen.add(f.id);
      const hit = marks.get(f.id);
      if (hit !== undefined) {
        hit.setLatLng([f.lat, f.lng]);
        continue;
      }
      const mk = L.marker([f.lat, f.lng], {
        title: f.id,
        // UR C.14：友釘壓打卡釘（z 600，僅次於自釘 1000）
        zIndexOffset: 600,
        icon: L.divIcon({
          className: "",
          html: `<div class="${styles.v2friend}">${esc(f.label)}</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      });
      mk.on("click", () => cbRef.current.onFriendClick(f.id));
      mk.addTo(layer);
      marks.set(f.id, mk);
    }
    for (const [id, mk] of marks) {
      if (seen.has(id)) continue;
      layer.removeLayer(mk);
      marks.delete(id);
    }
  }, [mapReady, friends]);

  // UR C.13 足跡虛線層（取消腳印動畫，僅保留灰色虛線；关 Sheet 不重建，仿 friendLayer）
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || map === null || L === null) return;
    if (footLayerRef.current === null) {
      footLayerRef.current = L.layerGroup().addTo(map);
    }
    const layer = footLayerRef.current;
    const marks = footMarksRef.current;
    // 清理旧脚印/动画（已取消动画，但保留清理以兼容历史缓存）
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (movingMarkerRef.current !== null) {
      movingMarkerRef.current.remove();
      movingMarkerRef.current = null;
    }
    if (movingRightRef.current !== null) {
      movingRightRef.current.remove();
      movingRightRef.current = null;
    }
    for (const [, mk] of marks) layer.removeLayer(mk);
    marks.clear();
    if (polylineRef.current !== null) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    if (trail === null || trail.length < 2) return;
    const sorted = [...trail].sort((a, b) => a.at - b.at);
    const latlngs = sorted.map((s) => [s.lat, s.lng] as [number, number]);
    polylineRef.current = L.polyline(latlngs, {
      color: "#9ca3af",
      weight: 2,
      opacity: 0.6,
      dashArray: "8 10",
      lineCap: "round",
      pane: "footPane",
    }).addTo(layer);
  }, [mapReady, trail]);

  return <div ref={holderRef} className={styles.v2map} />;
});

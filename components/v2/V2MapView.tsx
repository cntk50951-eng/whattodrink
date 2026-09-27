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
  OSM_ATTRIBUTION,
  OSM_MAX_NATIVE_ZOOM,
  OSM_URL,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  haversineMeters,
} from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { clusterPoints } from "@/lib/clusters";
import type { BeerIconComponent } from "@/components/marketing/beer-icons/wall";
import { iconForDrinkName } from "@/components/marketing/beer-icons/wall";
import type { V2Marker } from "./v2Pins";
import styles from "./v2.module.css";

/** UR2.8 同口徑聚合半徑（略大於單釘 40px，v2 釘比 doodle 小）。 */
const V2_CLUSTER_PX = 64;

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
};

export type V2MapApi = {
  recenter: () => void;
  fitHk: () => void;
  flyTo: (at: LatLng, zoom?: number) => void;
  getCenter: () => LatLng | null;
};

type V2MapViewProps = {
  others: V2Marker[];
  wants: V2WantMarker[];
  trail: V2TrailMarker[] | null;
  self: LatLng | null;
  onPinClick: (id: string) => void;
  onWantClick: (id: string) => void;
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
 * 共用層複用（geo 常數＋clusterPoints）；markers 按 props 重建；
 * 操作經 ref 暴露（父層按鈕調）。 reduced-motion 讀掛載時一次。
 */
export const V2MapView = forwardRef<V2MapApi, V2MapViewProps>(function V2MapView(
  { others, wants, trail, self, onPinClick, onWantClick },
  ref,
) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const trailRef = useRef<Leaflet.Polyline | null>(null);
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
  const cbRef = useRef({ onPinClick, onWantClick });
  useEffect(() => {
    cbRef.current = { onPinClick, onWantClick };
  });
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
      map = L.map(holderRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        minZoom: ZOOM_MIN,
        maxZoom: ZOOM_MAX,
        zoomAnimation: !reduced,
        fadeAnimation: !reduced,
      });
      L.tileLayer(OSM_URL, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: ZOOM_MAX,
        maxNativeZoom: OSM_MAX_NATIVE_ZOOM,
      }).addTo(map);
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], ZOOM_DEFAULT);
      // UR C.6 round-6：縮放結束觸發重建（見 zoomTick）。
      map.on("zoomend", () => {
        setZoomTick((t) => t + 1);
      });
      // 沉浸高地圖下整屏手勢：豎滑還頁面（沿 UR1.3 scroll-trap 配方）。
      holder.style.setProperty("touch-action", "pan-y pinch-zoom", "important");
      holder.dataset.ready = "1";
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      layerRef.current?.remove();
      trailRef.current?.remove();
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
    trailRef.current?.remove();
    unmountRootsAsync(artRoots.current);
    artRoots.current = [];
    const layer = L.layerGroup();
    // 本地圖注入隊列（他人單釘／散 pin／想喝釘共用；上圖後統一 createRoot）
    const pendingArt: { marker: Leaflet.Marker; Icon: BeerIconComponent }[] = [];

    // UR C.6 round-5：散 pin 名單失配（數據刷新致 id 對不上）同步清，
    // 否則僵尸散 pin 赖着不走（必要同步，沿 BeerIcon 同款註記口徑）。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const liveSpread =
      spreadIds === null ? null : others.filter((o) => spreadIds.includes(o.id));
    if (spreadIds !== null && (liveSpread === null || liveSpread.length === 0)) {
      setSpreadIds(null);
    }
    const spread =
      liveSpread !== null && liveSpread.length > 0 ? liveSpread : null;
    const spreadSet =
      spread === null ? null : new Set(spread.map((o) => o.id));

    // 他人：像素聚合（沿 UR2.8），單釘原樣、多釘數字簇（點徽 fit＋散 pin）。
    // 散 pin 成員不進聚合（否則徽還在，散了白散）；members 下標認 rest 數組。
    const rest =
      spreadSet === null ? others : others.filter((o) => !spreadSet.has(o.id));
    const pixels = rest.map((m) =>
      map.latLngToContainerPoint([m.lat, m.lng]),
    );
    for (const cluster of clusterPoints(pixels, V2_CLUSTER_PX)) {
      if (cluster.members.length === 1) {
        const m = others[cluster.members[0] as number] as V2Marker;
        const content = otherPinContent(m);
        const marker = L.marker([m.lat, m.lng], {
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
        continue;
      }
      const at = map.containerPointToLatLng([
        cluster.centroid.x,
        cluster.centroid.y,
      ]);
      const badge = L.marker(at, {
        icon: L.divIcon({
          className: "",
          html: `<div class="${styles.v2cluster}">${cluster.members.length}</div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      });
      // UR C.6 round-5：簇徽點擊以簇為中心 fit 最佳視野；成員扎堆
      // （最大相距 <40m，fit 也分不開）再把各枚擺開成地理真 pin。
      badge.on("click", () => {
        const ms = cluster.members.map((i) => rest[i] as V2Marker);
        const latlngs = ms.map((m) => [m.lat, m.lng] as [number, number]);
        const bounds = L.latLngBounds(latlngs);
        if (!bounds.isValid()) return;
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        if (sw.equals(ne)) {
          // 同點扎堆：南／北各擴 ~150m，落街區級視野看該點
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
        let maxD = 0;
        for (let a = 0; a < ms.length; a += 1) {
          for (let b = a + 1; b < ms.length; b += 1) {
            const ma = ms[a] as V2Marker;
            const mb = ms[b] as V2Marker;
            const d = haversineMeters(
              { lat: ma.lat, lng: ma.lng },
              { lat: mb.lat, lng: mb.lng },
            );
            if (d > maxD) maxD = d;
          }
        }
        // 散得開 fit 已夠分；切簇殘留必清，故一律重設散 pin 名單
        setSpreadIds(maxD < 40 ? ms.map((m) => m.id) : null);
      });
      badge.addTo(layer);
    }

    // UR C.6 round-5 同點散 pin：均分圓周擺開 ~20m（街區 zoom 可分，
    // 位移可忽略）；地理真 pin，點枚開卡照舊，縮放自跟地圖不擾。
    if (spread !== null) {
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
        const marker = L.marker([w.lat, w.lng], {
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
      const marker = L.marker([w.lat, w.lng], {
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

    // 足跡：序號釘＋連線（≥2 站才連，沿 UR3.4 口徑）
    if (trail !== null && trail.length > 0) {
      for (const s of trail) {
        L.marker([s.lat, s.lng], {
          interactive: false,
          icon: L.divIcon({
            className: "",
            html: `<div class="${styles.v2trailNum}">${s.n}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        }).addTo(layer);
      }
      if (trail.length >= 2) {
        trailRef.current = L.polyline(
          trail.map((s) => [s.lat, s.lng] as [number, number]),
          { color: "#2563eb", weight: 3, opacity: 0.85 },
        ).addTo(map);
      }
    }

    // 自己：藍點（watch 跟隨由父層 position 驅動重建）
    if (self !== null) {
      L.marker([self.lat, self.lng], {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `<div class="${styles.v2self}"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
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
  }, [mapReady, others, wants, trail, self, spreadIds, zoomTick]);

  return <div ref={holderRef} className={styles.v2map} />;
});

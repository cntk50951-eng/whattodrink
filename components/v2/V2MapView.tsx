"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
} from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { clusterPoints } from "@/lib/clusters";
import type { V2Marker } from "./v2Pins";
import styles from "./v2.module.css";

/** UR2.8 同口徑聚合半徑（略大於單釘 40px，v2 釘比 doodle 小）。 */
const V2_CLUSTER_PX = 64;

export type V2WantMarker = {
  id: string;
  lat: number;
  lng: number;
  emoji: string;
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
  // 回調 ref 化（marker 點擊閉包讀最新，不重建圖層樹；render 內不許寫 ref）。
  const cbRef = useRef({ onPinClick, onWantClick });
  useEffect(() => {
    cbRef.current = { onPinClick, onWantClick };
  });
  // init 是異步 import：ready 前 markers effect 直接返回，ready 後重跑一次
  const [mapReady, setMapReady] = useState(false);

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
    const layer = L.layerGroup();

    // 他人：像素聚合（沿 UR2.8），單釘原樣、多釘數字簇（點之放大散開）
    const pixels = others.map((m) =>
      map.latLngToContainerPoint([m.lat, m.lng]),
    );
    for (const cluster of clusterPoints(pixels, V2_CLUSTER_PX)) {
      if (cluster.members.length === 1) {
        const m = others[cluster.members[0] as number] as V2Marker;
        const dot = m.online ? `<span class="${styles.v2pinOnline}"></span>` : "";
        const marker = L.marker([m.lat, m.lng], {
          title: m.id,
          icon: L.divIcon({
            className: "",
            html: `<div class="${styles.v2pin}">${esc(m.label)}${dot}</div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
        });
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
      badge.on("click", () => {
        map.setView(at, Math.min(map.getZoom() + 2, ZOOM_MAX));
      });
      badge.addTo(layer);
    }

    // 我的想喝釘（琥珀實心，可點回看）
    for (const w of wants) {
      const marker = L.marker([w.lat, w.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="${styles.v2pinWant}">${esc(w.emoji)}</div>`,
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
  }, [mapReady, others, wants, trail, self]);

  return <div ref={holderRef} className={styles.v2map} />;
});

/**
 * UR C.9 縮放層級語義分組（純函數，可单测）。
 *
 * 為什麼要錨點而不是行政區／格子：api pins 只有自由文本 area（不可靠），
 * 後端加欄位等不起，逆地理編碼進不了渲染路徑；18 區多邊形又重又無聊
 * （"中西區" vs "蘭桂坊"），geohash 格子繼續匿名——商圈錨＋最近歸屬
 * 是唯一零後端、有名可讀、可单测的解。Voronoi 邊緣誤差放大即散，無礙。
 *
 * 層級（沿 ZOOM 常數口徑）：z≤11 按錨（全港一屏時只剩商圈徽）；
 * z≥12 像素聚類沿用（`clusterPoints`）。國家／城市只做模型字段——
 * 數據全在香港＋ZOOM_MIN=10 看不出一國，UI 出現那天數據先出港。
 */

export type AreaAnchor = {
  /** 穩定 id（kebab，未來 seed／DB 對接用）。 */
  id: string;
  /** 徽上名（短，如"銅鑼灣"）。 */
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
};

/** 香港商圈錨（16）：港島 6（含南區）／九龍 5／新界 5，中心取商圈地標概位。 */
export const AREA_ANCHORS: readonly AreaAnchor[] = [
  { id: "central", name: "中環", lat: 22.2819, lng: 114.158, city: "香港", country: "中國" },
  { id: "sheung-wan", name: "上環", lat: 22.287, lng: 114.15, city: "香港", country: "中國" },
  { id: "wan-chai", name: "灣仔", lat: 22.2797, lng: 114.1717, city: "香港", country: "中國" },
  { id: "causeway-bay", name: "銅鑼灣", lat: 22.2783, lng: 114.1827, city: "香港", country: "中國" },
  { id: "north-point", name: "北角", lat: 22.2916, lng: 114.2, city: "香港", country: "中國" },
  { id: "aberdeen", name: "香港仔", lat: 22.2479, lng: 114.1525, city: "香港", country: "中國" },
  { id: "tst", name: "尖沙咀", lat: 22.295, lng: 114.1694, city: "香港", country: "中國" },
  { id: "jordan", name: "佐敦", lat: 22.3045, lng: 114.1694, city: "香港", country: "中國" },
  { id: "mong-kok", name: "旺角", lat: 22.3193, lng: 114.1694, city: "香港", country: "中國" },
  { id: "sham-shui-po", name: "深水埗", lat: 22.3307, lng: 114.1625, city: "香港", country: "中國" },
  { id: "kwun-tong", name: "觀塘", lat: 22.308, lng: 114.2255, city: "香港", country: "中國" },
  { id: "tsuen-wan", name: "荃灣", lat: 22.37, lng: 114.114, city: "香港", country: "中國" },
  { id: "sha-tin", name: "沙田", lat: 22.382, lng: 114.188, city: "香港", country: "中國" },
  { id: "yuen-long", name: "元朗", lat: 22.445, lng: 114.022, city: "香港", country: "中國" },
  { id: "tai-po", name: "大埔", lat: 22.45, lng: 114.164, city: "香港", country: "中國" },
  { id: "tseung-kwan-o", name: "將軍澳", lat: 22.307, lng: 114.268, city: "香港", country: "中國" },
];

/** z≤此值按錨分組（以上走像素聚類）。全港一屏（z10–11）只剩商圈徽。 */
export const ANCHOR_ZOOM_MAX = 11;

function distSq(aLat: number, aLng: number, bLat: number, bLng: number): number {
  // 等距圓柱近似（香港緯度經度縮放 cos22°≈0.927；排名夠用，不用 haversine）。
  const dx = (aLng - bLng) * 0.927;
  const dy = aLat - bLat;
  return dx * dx + dy * dy;
}

/** 最近錨（空表回 null，調用方退像素聚類，永不拋）。 */
export function areaOf(lat: number, lng: number): AreaAnchor | null {
  let best: AreaAnchor | null = null;
  let bestD = Infinity;
  for (const a of AREA_ANCHORS) {
    const d = distSq(lat, lng, a.lat, a.lng);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

export type AreaGroup = {
  anchor: AreaAnchor;
  /** 成員在輸入數組裡的下標（沿 clusterPoints 口徑，輸入順序即渲染順序）。 */
  members: number[];
};

/**
 * 按錨分組：空錨成員（理論無，防禦）按輸入順序併入首組，不丟 pin。
 * 空輸入回空數組。
 */
export function groupByAnchor(
  points: readonly { lat: number; lng: number }[],
): AreaGroup[] {
  const byId = new Map<string, AreaGroup>();
  const order: AreaGroup[] = [];
  points.forEach((p, index) => {
    const anchor = areaOf(p.lat, p.lng);
    if (anchor === null) {
      if (order.length === 0) return;
      (order[0] as AreaGroup).members.push(index);
      return;
    }
    let g = byId.get(anchor.id);
    if (g === undefined) {
      g = { anchor, members: [] };
      byId.set(anchor.id, g);
      order.push(g);
    }
    g.members.push(index);
  });
  return order;
}

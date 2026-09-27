/**
 * UR C.14 round-2：重疊自動散開（像素空間，純函數可單測＋快照）。
 *
 * 業界口徑（Leaflet.markercluster／OMS／density-spread）：同點多枚在最大
 * zoom 也分不開，聚類徽＋點擊展開是標配；新派做法是像素碰撞即按確定性
 * Vogel 螺旋自動散開（zoom 無關的視覺分離，地理位移隨放大相對縮小）。
 * 本模塊取後者，並加兩條家規：
 * 1. live 釘（自／友）永不進輸入——调用方先过滤，活人釘死真實坐標，
 *    只散啤酒釘（他人／想喝／序號釘）；
 * 2. 超 cap 的同點組不硬散（螺旋再大也擠），收成 +N 堆疊，點徽開列表。
 */

export type SpreadPoint = {
  id: string;
  x: number;
  y: number;
};

export type SpreadPlan = {
  /** id → 像素偏移（無碰撞者為 0,0，調用方可跳過）。 */
  offsets: Map<string, { dx: number; dy: number }>;
  /** 超 cap 組：首枚留真位當代表（調用方畫 +N 徽），其餘收進列表。 */
  stacks: { keeperId: string; memberIds: string[] }[];
};

/** 黃金角（Vogel 螺旋，確定性：同輸入同輸出，與數據順序無關即需先排序——調用方按 id 排，見 planSpread）。 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** 第 k 枚（k≥1，keeper 佔 k=0 不動）的螺旋偏移；basePx 為第一環半徑。 */
export function vogelOffset(
  k: number,
  basePx: number,
): { dx: number; dy: number } {
  const r = basePx * Math.sqrt(k + 1);
  const a = k * GOLDEN_ANGLE;
  return { dx: r * Math.cos(a), dy: r * Math.sin(a) };
}

/** 單鏈像素分組（threshold 內傳遞相連即同組；沿 `clusterPoints` 口徑）。 */
export function groupOverlaps(
  points: readonly SpreadPoint[],
  thresholdPx: number,
): number[][] {
  const n = points.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (a: number): number => {
    let r = a;
    while (parent[r] !== r) r = parent[r] as number;
    return r;
  };
  const t2 = thresholdPx * thresholdPx;
  for (let i = 0; i < n; i += 1) {
    const pi = points[i] as SpreadPoint;
    for (let j = i + 1; j < n; j += 1) {
      const pj = points[j] as SpreadPoint;
      const dx = pi.x - pj.x;
      const dy = pi.y - pj.y;
      if (dx * dx + dy * dy > t2) continue;
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent[rj] = ri;
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    const g = groups.get(r);
    if (g === undefined) groups.set(r, [i]);
    else g.push(i);
  }
  return [...groups.values()];
}

export type PlanSpreadOpts = {
  /** 像素碰撞閾值（沿 V2_CLUSTER_PX 略小：40px 釘取 48）。 */
  thresholdPx: number;
  /** 螺旋第一環半徑 px（視覺分離量，zoom 無關）。 */
  basePx: number;
  /** 同組超此數即收 +N（螺旋再大也擠）。 */
  cap: number;
};

export const SPREAD_DEFAULTS: PlanSpreadOpts = {
  thresholdPx: 48,
  basePx: 30,
  cap: 6,
};

/**
 * 散開計劃：組內按 id 排序（確定性）→ 首枚留真位 → 其餘 Vogel 螺旋；
 * 超 cap 組首枚留真位當 +N 代表。單枚組零偏移。
 */
export function planSpread(
  points: readonly SpreadPoint[],
  opts: PlanSpreadOpts = SPREAD_DEFAULTS,
): SpreadPlan {
  const offsets = new Map<string, { dx: number; dy: number }>();
  const stacks: SpreadPlan["stacks"] = [];
  for (const p of points) offsets.set(p.id, { dx: 0, dy: 0 });
  for (const g of groupOverlaps(points, opts.thresholdPx)) {
    if (g.length <= 1) continue;
    const ordered = [...g].sort((a, b) =>
      (points[a] as SpreadPoint).id.localeCompare((points[b] as SpreadPoint).id),
    );
    const keeper = points[ordered[0] as number] as SpreadPoint;
    const rest = ordered.slice(1);
    if (g.length > opts.cap) {
      stacks.push({
        keeperId: keeper.id,
        memberIds: rest.map((i) => (points[i] as SpreadPoint).id),
      });
      continue;
    }
    rest.forEach((idx, k) => {
      const p = points[idx] as SpreadPoint;
      offsets.set(p.id, vogelOffset(k + 1, opts.basePx));
    });
  }
  return { offsets, stacks };
}

/**
 * live 避讓：啤酒釘像素若落在任一 live 像素 minDistPx 內，沿徑向推出
 * 到 minDistPx＋pad（活人不动，只推酒；與 planSpread 疊加使用，先散開後避讓）。
 */
export function avoidLive(
  points: readonly SpreadPoint[],
  live: readonly { x: number; y: number }[],
  minDistPx: number,
  padPx = 6,
): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>();
  if (live.length === 0) return out;
  const want = minDistPx + padPx;
  for (const p of points) {
    let best: { dx: number; dy: number } | null = null;
    for (const l of live) {
      const dx = p.x - l.x;
      const dy = p.y - l.y;
      const d = Math.hypot(dx, dy);
      if (d >= want) continue;
      // 同像素（d=0）沿 +x 推出，確定性不斷言方向。
      const ux = d === 0 ? 1 : dx / d;
      const uy = d === 0 ? 0 : dy / d;
      const push = want - d;
      const cand = { dx: ux * push, dy: uy * push };
      if (
        best === null ||
        cand.dx * cand.dx + cand.dy * cand.dy >
          best.dx * best.dx + best.dy * best.dy
      ) {
        best = cand;
      }
    }
    if (best !== null) out.set(p.id, best);
  }
  return out;
}

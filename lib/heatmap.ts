/**
 * UR E.6 热点模式 1km 格分组（纯函数可单测）。
 * 格心即巡游定位与 fit 目标；24h 窗沿 E.5。
 */

import { haversineMeters } from "./geo";

/** 24h 窗口（沿 E.5 口径）。 */
export const HEAT_WINDOW_MS = 24 * 3600_000;

/** 1km 格（纬度 0.009°≈1km；HK 纬度经度 0.01°≈1km，cos22° 口径见 geoAreas）。
 * UR E.6 round-4：3km→1km——3km 格常把两个视觉斑包进同一格，巡游单格聚焦
 * 仍见双斑；1km 格一格一斑，逐格跳即一次只见一个热点。 */
export const HEAT_CELL_LAT = 0.009;
export const HEAT_CELL_LNG = 0.01;

export type HeatCellInput = {
  id: string;
  lat: number;
  lng: number;
  /** epoch ms（null／脏值即不进格）。 */
  at: number | null;
};

export type HeatCell = {
  key: string;
  lat: number;
  lng: number;
  ids: string[];
};

/** 24h 内点按 1km 格收拢（格心＋成员 id，倒序按成员数，沿 mapSpread 确定性口径）。 */
export function groupHeatCells(
  points: readonly HeatCellInput[],
  nowMs: number = Date.now(),
): HeatCell[] {
  const groups = new Map<string, { lat: number; lng: number; ids: string[] }>();
  for (const p of points) {
    if (
      typeof p.id !== "string" ||
      p.id === "" ||
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lng) ||
      p.at === null ||
      !Number.isFinite(p.at) ||
      p.at <= 0 ||
      p.at > nowMs ||
      nowMs - p.at > HEAT_WINDOW_MS
    ) {
      continue;
    }
    const cx = Math.floor(p.lat / HEAT_CELL_LAT);
    const cy = Math.floor(p.lng / HEAT_CELL_LNG);
    const key = `${cx}:${cy}`;
    const hit = groups.get(key);
    if (hit === undefined) {
      groups.set(key, {
        lat: (cx + 0.5) * HEAT_CELL_LAT,
        lng: (cy + 0.5) * HEAT_CELL_LNG,
        ids: [p.id],
      });
    } else if (!hit.ids.includes(p.id)) {
      hit.ids.push(p.id);
    }
  }
  const cells: HeatCell[] = [...groups.entries()].map(([key, g]) => ({
    key,
    lat: g.lat,
    lng: g.lng,
    ids: [...g.ids].sort(),
  }));
  cells.sort((a, b) => b.ids.length - a.ids.length || (a.key < b.key ? -1 : 1));
  return cells;
}

/**
 * UR E.6 round-4 热点巡游排序：起点离我最近，之后每一步都是离当前格最近
 * 的未访格（贪心最近邻链；“基于当前热点跳下一个”的字面实现）。
 * origin 为 null（无定位）时原样返回（沿 groupHeatCells 成员数序）。
 */
export function orderHeatCellsTour(
  cells: readonly HeatCell[],
  origin: { lat: number; lng: number } | null,
): HeatCell[] {
  if (cells.length <= 1 || origin === null) return [...cells];
  const rest = [...cells];
  const ordered: HeatCell[] = [];
  let cur = origin;
  while (rest.length > 0) {
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < rest.length; i += 1) {
      const c = rest[i] as HeatCell;
      const d = haversineMeters(cur, { lat: c.lat, lng: c.lng });
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const nxt = rest.splice(best, 1)[0] as HeatCell;
    ordered.push(nxt);
    cur = { lat: nxt.lat, lng: nxt.lng };
  }
  return ordered;
}

export type HeatMemberArea = {
  id: string;
  /** place_name（null／空即未知地点）。 */
  area: string | null;
};

export type HeatCellSummary = {
  /** 众数地点（成员全未知即 null，调用方退 fallback 文案）。 */
  area: string | null;
  /** 格成员数（打卡记录数）。 */
  count: number;
  /** 离 origin 米数（巡游无定位即 null）。 */
  distanceM: number | null;
};

/**
 * UR E.6 round-5 热点信息卡：地点取成员 area 众数（平票先到先得，确定性），
 * 距离量到格心（格 1km，fuzz 口径下够用）。
 */
export function summarizeHeatCell(
  cell: HeatCell,
  members: readonly HeatMemberArea[],
  origin: { lat: number; lng: number } | null,
): HeatCellSummary {
  const byId = new Map(members.map((m) => [m.id, m] as const));
  const votes = new Map<string, number>();
  const order: string[] = [];
  for (const id of cell.ids) {
    const raw = byId.get(id)?.area;
    if (raw === null || raw === undefined || raw.trim() === "") continue;
    const name = raw.trim();
    if (!votes.has(name)) {
      votes.set(name, 0);
      order.push(name);
    }
    votes.set(name, (votes.get(name) as number) + 1);
  }
  let area: string | null = null;
  let best = 0;
  for (const name of order) {
    const v = votes.get(name) as number;
    if (v > best) {
      best = v;
      area = name;
    }
  }
  return {
    area,
    count: cell.ids.length,
    distanceM:
      origin === null
        ? null
        : haversineMeters(origin, { lat: cell.lat, lng: cell.lng }),
  };
}

/**
 * UR E.6 round-7 钻取连通片：目标格＋八邻接连通的非空格全并入（BFS，key 即格坐标，
 * 对角亦连通；传递闭包）。1km 格常把同一片热区切成多格，钻取只散本格即“只见一个”，
 * 连通并入后即片区全部打卡；孤立格退化为本格（行为与之前一致）。
 */
export function connectedCellIds(
  target: HeatCell,
  cells: readonly HeatCell[],
): string[] {
  const byKey = new Map(cells.map((c) => [c.key, c] as const));
  const seen = new Set<string>([target.key]);
  const queue: string[] = [target.key];
  while (queue.length > 0) {
    const key = queue.pop() as string;
    const [cx, cy] = key.split(":").map(Number);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        const nk = `${cx + dx}:${cy + dy}`;
        if (seen.has(nk) || !byKey.has(nk)) continue;
        seen.add(nk);
        queue.push(nk);
      }
    }
  }
  const ids = new Set<string>();
  for (const key of seen) {
    const c = byKey.get(key);
    if (c !== undefined) for (const id of c.ids) ids.add(id);
  }
  return [...ids].sort();
}

/**
 * UR2.8 睇全港防挤：像素空间贪心聚合（纯函数，可单测）。
 *
 * 为什么是像素空间而不是经纬度：同一个 3km 间距在 z18 是两条街、
 * 在 z10 是同一个点——“挤不挤”是屏幕概念，必须按当前 zoom 投影后再判。
 * 投影（latLngToContainerPoint）是 Leaflet 的事，合 whom 是这里的事。
 */

export type PixelPoint = {
  x: number;
  y: number;
};

export type Cluster = {
  /** 成员在输入数组里的下标（输入顺序即渲染顺序，稳定）。 */
  members: number[];
  /** 成员质心（像素），调用方转回经纬度落簇钉。 */
  centroid: PixelPoint;
};

/**
 * 贪心聚合：按输入顺序，每个点并入第一个质心距离 <= radiusPx 的簇，
 * 否则自立一簇。O(n²)，点位是个位数到几十量级足够（mock 仅 4 点）。
 * 单成员簇＝街区 zoom 下的原样单 pin，调用方照旧渲染。
 */
export function clusterPoints(
  points: readonly PixelPoint[],
  radiusPx: number,
): Cluster[] {
  const clusters: Cluster[] = [];
  for (const [index, p] of points.entries()) {
    const hit = clusters.find((c) => {
      const dx = c.centroid.x - p.x;
      const dy = c.centroid.y - p.y;
      return Math.hypot(dx, dy) <= radiusPx;
    });
    if (hit === undefined) {
      clusters.push({ members: [index], centroid: { x: p.x, y: p.y } });
      continue;
    }
    const n = hit.members.length;
    hit.members.push(index);
    // 增量质心：免得每次重算全员均值。
    hit.centroid = {
      x: (hit.centroid.x * n + p.x) / (n + 1),
      y: (hit.centroid.y * n + p.y) / (n + 1),
    };
  }
  return clusters;
}

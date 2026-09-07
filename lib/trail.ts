/**
 * UR3.4 我的足迹数据源（返工后口径）。
 *
 * - 足迹＝我自己的打卡，不是别人的，更不是编的 mock 站。
 *   现在只有一枚：当前的想喝钉（`wantRecord`，localStorage）。
 * - 以后打卡多了就是列表（`checkins where user_id＝我`），本函数原样 work。
 */

import type { LatLng } from "./geo";
import type { WantRecord } from "./wantRecord";
import { parseWantHistory } from "./wantRecord";

export type TrailStop = {
  id: string;
  beerId: string;
  beerName: string;
  at: number;
  position: LatLng;
  placeName: string;
};

/**
 * 想喝史→足迹站（无记录即无足迹，不编数据；防脏读再过一次校验＋排序，
 * 和存储层同一口径）。
 */
export function trailStops(records: readonly WantRecord[]): TrailStop[] {
  return parseWantHistory([...records]).map((record) => ({
    id: `want-${record.at}`,
    beerId: record.beer.id,
    beerName: record.beer.name,
    at: record.at,
    position: record.position,
    placeName: record.placeName ?? "",
  }));
}

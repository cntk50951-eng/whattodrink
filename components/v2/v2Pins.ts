/**
 * UR C.1 v2 marker 純映射（可單測）：api pins／MOCK → V2MapView 吃的
 * marker 模型。fuzz／過濾邏輯住在 lib（`toPinJson`），這裡只做形狀轉換。
 */

import type { PinJson } from "../../lib/api/pins";
import { MOCK_CHECKINS } from "../../lib/checkins";
import type { Checkin } from "../../lib/checkins";

export type V2Marker = {
  id: string;
  lat: number;
  lng: number;
  /** 首字（暱稱首字，無則酒字）。 */
  label: string;
  online: boolean;
};

export function apiPinsToMarkers(pins: readonly PinJson[]): V2Marker[] {
  return pins.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    label: (p.nickname ?? p.drinkName ?? "酒").slice(0, 1),
    online: p.isOnline,
  }));
}

export function mockToMarkers(checkins: readonly Checkin[] = MOCK_CHECKINS): V2Marker[] {
  return checkins.map((c) => ({
    id: c.id,
    lat: c.position.lat,
    lng: c.position.lng,
    label: (c.nickname ?? c.drinkName ?? "酒").slice(0, 1),
    online: false,
  }));
}

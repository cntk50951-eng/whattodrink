import { describe, expect, it, vi } from "vitest";

import { startWatch } from "./geoWatch";
import type { WatchSource } from "./geoWatch";

function makeSource(): WatchSource & {
  success: PositionCallback | null;
  failure: PositionErrorCallback | null;
  cleared: number[];
} {
  const box: WatchSource & {
    success: PositionCallback | null;
    failure: PositionErrorCallback | null;
    cleared: number[];
  } = {
    success: null,
    failure: null,
    cleared: [],
    watchPosition: (success, failure) => {
      box.success = success;
      box.failure = failure ?? null;
      return 7;
    },
    clearWatch: (id: number) => {
      box.cleared.push(id);
    },
  };
  return box;
}

function fakePos(lat: number, lng: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 0,
    toJSON: () => ({}),
  };
}

describe("startWatch", () => {
  it("forwards fixes as LatLng", () => {
    const source = makeSource();
    const onPosition = vi.fn();
    startWatch(source, { onPosition, onError: () => {} }, 15000);
    source.success?.(fakePos(22.28, 114.15));
    expect(onPosition).toHaveBeenCalledWith({ lat: 22.28, lng: 114.15 });
  });

  it("forwards the raw error code", () => {
    const source = makeSource();
    const onError = vi.fn();
    startWatch(source, { onPosition: () => {}, onError }, 15000);
    source.failure?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    expect(onError).toHaveBeenCalledWith(1);
  });

  it("returns an idempotent stop that clears the watch id", () => {
    const source = makeSource();
    const stop = startWatch(
      source,
      { onPosition: () => {}, onError: () => {} },
      15000,
    );
    stop();
    stop();
    expect(source.cleared).toEqual([7]);
  });
});

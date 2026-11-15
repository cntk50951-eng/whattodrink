import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OPENING_WAIT_MS, preloadIntroArtwork, type ArtworkSource } from "./preload";

function setup(): {
  images: HTMLImageElement[];
  ready: ReturnType<typeof vi.fn>;
  start: (opening?: ArtworkSource[]) => () => void;
} {
  const images: HTMLImageElement[] = [];
  const ready = vi.fn();
  const createImage = (): HTMLImageElement => {
    const image = { onload: null, onerror: null, src: "" } as HTMLImageElement;
    images.push(image);
    return image;
  };
  return {
    images, ready,
    start: (opening = [{ src: "hero" }, { src: "photo" }]) => preloadIntroArtwork({
      opening,
      remaining: ["camera", "editor", "preview", "map"].map((src) => ({ src })),
      onReady: ready,
      createImage,
    }),
  };
}

describe("intro-next cold-start artwork", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("releases playback on the deadline even if every opening request hangs", async () => {
    const { images, ready, start } = setup();
    const stop = start();
    expect(images.map((image) => image.src)).toEqual(["hero", "photo"]);
    await vi.advanceTimersByTimeAsync(OPENING_WAIT_MS - 1);
    expect(ready).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(ready).toHaveBeenCalledOnce();
    expect(images.map((image) => image.src)).toEqual(["hero", "photo", "camera", "editor"]);
    stop();
  });

  it("starts as soon as the opening loads without waiting for later scenes", async () => {
    const { images, ready, start } = setup();
    const stop = start();
    images[0].onload?.call(images[0], new Event("load"));
    expect(ready).not.toHaveBeenCalled();
    images[1].onload?.call(images[1], new Event("load"));
    await vi.advanceTimersByTimeAsync(0);
    expect(ready).toHaveBeenCalledOnce();
    expect(images.slice(2).map((image) => image.fetchPriority)).toEqual(["low", "low"]);
    images[2].onload?.call(images[2], new Event("load"));
    await vi.advanceTimersByTimeAsync(0);
    expect(images[4].src).toBe("preview");
    stop();
  });

  it("continues after an image error rather than locking the play control", async () => {
    const { images, ready, start } = setup();
    const stop = start([{ src: "missing" }]);
    images[0].onerror?.call(images[0], new Event("error"));
    await vi.advanceTimersByTimeAsync(0);
    expect(ready).toHaveBeenCalledOnce();
    stop();
  });

  it("does not restart playback when opening images arrive after the deadline", async () => {
    const { images, ready, start } = setup();
    const stop = start();
    await vi.advanceTimersByTimeAsync(OPENING_WAIT_MS);
    images[0].onload?.call(images[0], new Event("load"));
    images[1].onload?.call(images[1], new Event("load"));
    await vi.advanceTimersByTimeAsync(0);
    expect(ready).toHaveBeenCalledOnce();
    stop();
  });

  it("does not let a stalled background batch block all following scenes", async () => {
    const { images, start } = setup();
    const stop = start();
    await vi.runAllTimersAsync();
    expect(images.map((image) => image.src)).toEqual(["hero", "photo", "camera", "editor", "preview", "map"]);
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it("cancels deadlines and stale callbacks on unmount or a language change", async () => {
    const { images, ready, start } = setup();
    const stop = start();
    stop();
    await vi.runAllTimersAsync();
    expect(ready).not.toHaveBeenCalled();
    expect(images).toHaveLength(2);
    expect(images.every((image) => image.onload === null && image.onerror === null)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels background workers without starting another request", async () => {
    const { images, start } = setup();
    const stop = start();
    await vi.advanceTimersByTimeAsync(OPENING_WAIT_MS);
    stop();
    await vi.runAllTimersAsync();
    expect(images).toHaveLength(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("warms the locale-specific responsive variants with opening priority", () => {
    const { images, start } = setup();
    const stop = start([{ src: "/en/detail.webp", srcSet: "/en/detail-640.webp 640w", sizes: "42vh" }]);
    expect(images[0]).toMatchObject({
      src: "/en/detail.webp", srcset: "/en/detail-640.webp 640w", sizes: "42vh", fetchPriority: "high", decoding: "async",
    });
    stop();
  });
});

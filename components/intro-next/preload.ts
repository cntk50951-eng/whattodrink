export type ArtworkSource = { src: string; srcSet?: string; sizes?: string };

export const OPENING_WAIT_MS = 1800;
const IMAGE_WAIT_MS = 8000;
const BACKGROUND_CONCURRENCY = 2;

/** Opening artwork gets priority; a stalled image must never lock out playback. */
export function preloadIntroArtwork({
  opening, remaining, onReady, createImage = () => new Image(),
}: {
  opening: readonly ArtworkSource[];
  remaining: readonly ArtworkSource[];
  onReady: () => void;
  createImage?: () => HTMLImageElement;
}): () => void {
  let cancelled = false;
  let released = false;
  let next = 0;
  const pending = new Set<() => void>();

  const load = (source: ArtworkSource, priority: "high" | "low"): Promise<void> => new Promise((resolve) => {
    const image = createImage();
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      pending.delete(finish);
      resolve();
    };
    const timer = setTimeout(finish, IMAGE_WAIT_MS);
    pending.add(finish);
    image.onload = finish;
    image.onerror = finish;
    image.decoding = "async";
    image.fetchPriority = priority;
    if (source.sizes) image.sizes = source.sizes;
    if (source.srcSet) image.srcset = source.srcSet;
    image.src = source.src;
  });

  const warmRemaining = async (): Promise<void> => {
    while (!cancelled && next < remaining.length) {
      const source = remaining[next++];
      await load(source, "low");
    }
  };
  const release = (): void => {
    if (cancelled || released) return;
    released = true;
    clearTimeout(deadline);
    onReady();
    for (let i = 0; i < BACKGROUND_CONCURRENCY; i++) void warmRemaining();
  };
  const deadline = setTimeout(release, OPENING_WAIT_MS);
  void Promise.all(opening.map((source) => load(source, "high"))).then(release);

  return () => {
    cancelled = true;
    clearTimeout(deadline);
    for (const finish of pending) finish();
  };
}

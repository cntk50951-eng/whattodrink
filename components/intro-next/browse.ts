type BrowseScene<Id extends string> = { id: Id; shots: readonly { at: number }[] };
export type BrowseStop<Id extends string = string> = {
  id: string;
  frame: number;
  settledFrame: number;
  shotIndex: number;
} & ({ kind: "screen"; sceneId: Id } | { kind: "intro" | "end"; sceneId: null });

/** The same cuts drive playback and browsing; land after entrances, never on a fade. */
export function buildBrowseStops<Id extends string>(scenes: readonly BrowseScene<Id>[], starts: readonly number[], end: number, fps: number, totalFrames: number): BrowseStop<Id>[] {
  const frame = (seconds: number): number => Math.max(0, Math.min(totalFrames - 1, Math.round(seconds * fps)));
  const stops: BrowseStop<Id>[] = [{ id: "intro", kind: "intro", sceneId: null, shotIndex: 0, frame: 0, settledFrame: frame(2.8) }];
  scenes.forEach((scene, i) => scene.shots.forEach((shot, shotIndex) => {
    const at = starts[i] + shot.at;
    const next = scene.shots[shotIndex + 1]?.at;
    const boundary = next === undefined ? starts[i + 1] ?? end : starts[i] + next;
    const settled = Math.min(at + (shotIndex === 0 ? 2.1 : 1.1), boundary - 0.15);
    stops.push({ id: `${scene.id}:${shotIndex}`, kind: "screen", sceneId: scene.id, shotIndex, frame: frame(at), settledFrame: frame(settled) });
  }));
  stops.push({ id: "end", kind: "end", sceneId: null, shotIndex: 0, frame: frame(end), settledFrame: frame(end + 2.8) });
  return stops;
}

export function browseIndexAt(frame: number, stops: readonly BrowseStop[]): number {
  let index = stops.length ? 0 : -1;
  for (let i = 1; i < stops.length; i++) {
    if (frame < stops[i].frame) break;
    index = i;
  }
  return index;
}

type BrowsePlayer = { pause: () => void; seekTo: (frame: number) => void };
export function seekBrowseStop(player: BrowsePlayer, index: number, stops: readonly BrowseStop[]): number {
  if (!stops.length) return -1;
  const target = Math.max(0, Math.min(stops.length - 1, index));
  // Remotion resumes a seek made while playing. Pause first to respect manual reading.
  player.pause();
  player.seekTo(stops[target].settledFrame);
  return target;
}

export function isHorizontalIntent(dx: number, dy: number): boolean {
  return Math.abs(dx) >= 12 && Math.abs(dx) > Math.abs(dy) * 1.4;
}

/** A deliberate central horizontal swipe; short taps and vertical drags do not navigate. */
export function swipeDirection(dx: number, dy: number, width: number): -1 | 1 | null {
  const threshold = Math.max(44, Math.min(90, width * 0.08));
  if (!isHorizontalIntent(dx, dy) || Math.abs(dx) < threshold) return null;
  return dx < 0 ? 1 : -1;
}

export function completeSwipe(dx: number, dy: number, width: number, cancelled: boolean, interrupted: boolean, wasPlaying: boolean): { direction: -1 | 1 | null; resume: boolean } {
  const direction = cancelled ? null : swipeDirection(dx, dy, width);
  return { direction, resume: direction === null && interrupted && wasPlaying };
}

/** Pure playback helpers keep chapter boundaries and preview URLs safe. */
export function previewFrame(raw: string | null, fps: number, totalFrames: number): number | null {
  if (raw === null || raw.trim() === "") return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds)) return null;
  return Math.max(0, Math.min(totalFrames - 1, Math.round(seconds * fps)));
}

type PlaybackTarget = {
  mute: () => void;
  pause: () => void;
  seekTo: (frame: number) => void;
  play: () => void;
};
type PlaybackStart = {
  search: string;
  fps: number;
  totalFrames: number;
  reducedMotion: boolean;
  reading: boolean;
  readingFrame: number;
  reducedFrame: number;
};

/** A silent story must never wait for audio permission before its clock can run. */
export function initializePlayback(player: PlaybackTarget, options: PlaybackStart): void {
  const query = new URLSearchParams(options.search);
  const requestedFrame = previewFrame(query.get("t"), options.fps, options.totalFrames);
  player.mute();
  // Public time links start playback there. Only explicit previews freeze the story.
  if (query.get("preview") === "1") {
    player.pause();
    player.seekTo(requestedFrame ?? options.readingFrame);
    return;
  }
  if (options.reducedMotion || options.reading) {
    player.pause();
    player.seekTo(options.reducedMotion ? options.reducedFrame : options.readingFrame);
    return;
  }
  if (requestedFrame !== null) {
    player.pause();
    player.seekTo(requestedFrame);
  }
  player.play();
}

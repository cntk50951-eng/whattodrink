/** Pure playback helpers keep chapter boundaries and preview URLs safe. */
export function previewFrame(raw: string | null, fps: number, totalFrames: number): number | null {
  if (raw === null || raw.trim() === "") return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds)) return null;
  return Math.max(0, Math.min(totalFrames - 1, Math.round(seconds * fps)));
}

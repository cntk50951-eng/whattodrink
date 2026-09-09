/**
 * UR2.3 browser audio prep — decode any recording (MediaRecorder webm/opus)
 * to 16k mono PCM WAV base64 for the /api/transcribe route (iFlytek IAT
 * only accepts L16/16kHz). Pure client code, no dependencies.
 */

/** Decode + downmix + resample to 16kHz mono Float32. */
export async function toMono16k(blob: Blob): Promise<Float32Array> {
  const Ctx =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const raw = new Float32Array(await blob.arrayBuffer());
  // Decode via a temp context at the file's native rate.
  const TmpCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const tmp = new TmpCtx();
  try {
    const decoded = await tmp.decodeAudioData(raw.buffer as ArrayBuffer);
    const length = Math.ceil((decoded.length / decoded.sampleRate) * 16000);
    const offline = new Ctx(1, length, 16000);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    void tmp.close().catch(() => {});
  }
}

/** Float32 mono → 16-bit PCM WAV base64 (44-byte header + samples). */
export function encodeWavBase64(mono16k: Float32Array): string {
  const n = mono16k.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 16000 * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, mono16k[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** One call: recording blob → 16k WAV base64, ready for /api/transcribe. */
export async function recordingToWavBase64(blob: Blob): Promise<string> {
  return encodeWavBase64(await toMono16k(blob));
}

/**
 * MediaRecorder chunks → 可播 blob。空 chunk 丟掉；什麼都沒錄到回 null，
 * 調用方顯示 recordEmpty，不給啞播放鈕（UR4.1 v6 真因的純函數守衛）。
 */
export function buildRecordingBlob(
  chunks: Blob[],
  mimeType: string,
): Blob | null {
  const kept = chunks.filter((c) => c.size > 0);
  if (kept.length === 0) return null;
  const blob = new Blob(kept, { type: mimeType || "audio/webm" });
  return blob.size === 0 ? null : blob;
}

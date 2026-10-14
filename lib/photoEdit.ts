/**
 * UR G.11 照片編輯器（v2-only；純數學層，可單測）。
 * 口徑對標 iOS `PhotoEdit.swift`（調整 −1…1／畫幅／順時針 90°／居中裁切）；
 * 烘焙管線：旋轉 → 裁切 → 調整 → 濾鏡 → 文字（canvas 兩 pass，預覽即成圖）。
 * 量綱換算沿 iOS：亮度 ±0.25、對比 ±35%、飽和 ±60%、暖色 R＋B− ±12%。
 */

export type PhotoRatio = "original" | "square" | "portrait";

export type PhotoEdit = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  ratio: PhotoRatio;
  quarterTurns: number;
};

export function blankEdit(): PhotoEdit {
  return { brightness: 0, contrast: 0, saturation: 0, warmth: 0, ratio: "original", quarterTurns: 0 };
}

function clampUnit(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(-1, v));
}

/** 外來 edit 消毒（壞值歸零，防髒 localStorage／壞草稿帶歪圖）。 */
export function sanitizeEdit(raw: unknown): PhotoEdit {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const ratio = r.ratio === "square" || r.ratio === "portrait" ? r.ratio : "original";
  const turns = typeof r.quarterTurns === "number" && Number.isFinite(r.quarterTurns) ? ((Math.floor(r.quarterTurns) % 4) + 4) % 4 : 0;
  return {
    brightness: clampUnit(r.brightness),
    contrast: clampUnit(r.contrast),
    saturation: clampUnit(r.saturation),
    warmth: clampUnit(r.warmth),
    ratio,
    quarterTurns: turns,
  };
}

export function isIdentityEdit(e: PhotoEdit): boolean {
  return (
    e.brightness === 0 &&
    e.contrast === 0 &&
    e.saturation === 0 &&
    e.warmth === 0 &&
    e.ratio === "original" &&
    e.quarterTurns % 4 === 0
  );
}

/** 旋轉後尺寸（奇數次互換寬高；iOS rotatedSize 口徑）。 */
export function rotatedSize(w: number, h: number, quarterTurns: number): { w: number; h: number } {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return { w: 0, h: 0 };
  return quarterTurns % 2 === 0 ? { w: Math.round(w), h: Math.round(h) } : { w: Math.round(h), h: Math.round(w) };
}

/** 居中裁切矩形（左上原點；無畫幅或已一致回整圖；iOS cropRect 口徑）。 */
export function cropRect(w: number, h: number, ratio: PhotoRatio): { x: number; y: number; w: number; h: number } {
  const full = { x: 0, y: 0, w: Math.round(w), h: Math.round(h) };
  if (w <= 0 || h <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  const target = ratio === "square" ? 1 : ratio === "portrait" ? 4 / 5 : null;
  if (target === null) return full;
  const current = w / h;
  if (Math.abs(current - target) < 0.0005) return full;
  if (current > target) {
    const cw = Math.floor(h * target);
    return { x: Math.floor((w - cw) / 2), y: 0, w: cw, h: Math.round(h) };
  }
  const ch = Math.floor(w / target);
  return { x: 0, y: Math.floor((h - ch) / 2), w: Math.round(w), h: ch };
}

/**
 * 調整量 → canvas `ctx.filter` CSS 串（亮度／對比／飽和沿 iOS 量綱；
 * 暖色正值走 sepia，負值走 hue-rotate＋飽和微調——CSS 無通道增益，近似但預覽＝成圖）。
 * 空串＝不動（調用方不設 filter）。
 */
export function adjustCss(e: PhotoEdit): string {
  const parts: string[] = [];
  if (e.brightness !== 0) parts.push(`brightness(${(1 + e.brightness * 0.25).toFixed(3)})`);
  if (e.contrast !== 0) parts.push(`contrast(${(1 + e.contrast * 0.35).toFixed(3)})`);
  if (e.saturation !== 0) parts.push(`saturate(${(1 + e.saturation * 0.6).toFixed(3)})`);
  if (e.warmth > 0) parts.push(`sepia(${(e.warmth * 0.35).toFixed(3)})`);
  else if (e.warmth < 0) parts.push(`hue-rotate(${Math.round(e.warmth * 15)}deg)`);
  return parts.join(" ");
}

export type TextPos = "top" | "center" | "bottom";

export type TextLayer = { text: string; color: string; size: number; pos: TextPos };

export const TEXT_COLORS = ["#ffffff", "#fde047", "#f9a8d4", "#86efac", "#93c5fd", "#fca5a5", "#111111"] as const;

export const TEXT_MAX = 100;

export function blankText(): TextLayer {
  return { text: "", color: "#ffffff", size: 2, pos: "bottom" };
}

export function sanitizeText(raw: unknown): TextLayer {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const color = typeof r.color === "string" && (TEXT_COLORS as readonly string[]).includes(r.color) ? r.color : "#ffffff";
  const size = typeof r.size === "number" && (r.size === 1 || r.size === 2 || r.size === 3) ? r.size : 2;
  const pos = r.pos === "top" || r.pos === "center" || r.pos === "bottom" ? r.pos : "bottom";
  const text = typeof r.text === "string" ? r.text.slice(0, TEXT_MAX) : "";
  return { text, color, size, pos };
}

export type Measurer = { measureText: (s: string) => { width: number } };

/**
 * 換行（按像素寬切，至多 maxLines，超了截＋…；ctx 由調用方傳，單測可 mock）。
 */
export function wrapLines(m: Measurer, text: string, maxWidth: number, maxLines: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (out.length >= maxLines) break;
    if (para === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const ch of para) {
      const trial = line + ch;
      if (m.measureText(trial).width <= maxWidth || line === "") {
        line = trial;
      } else {
        out.push(line);
        if (out.length >= maxLines) break;
        line = ch;
      }
    }
    if (out.length < maxLines) out.push(line);
  }
  const lines = out.slice(0, maxLines);
  if (out.length > maxLines && lines.length > 0) {
    lines[lines.length - 1] = ((lines[lines.length - 1] as string) + "…").slice(-20);
  }
  return lines;
}

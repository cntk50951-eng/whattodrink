'use client';

import React, { createContext, useContext, useId } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

// ───────── 主題：色值對應 iOS NightPalette／NightPaletteLight；品牌色不隨主題變 ─────────
export type Mode = 'dark' | 'light';
export const brand = { amber: '#F59E0B', a: '#FFB43A', b: '#FF7A4F', c: '#FF5C7A', onAmber: '#2A1700' };
export const grad = `linear-gradient(120deg, ${brand.a}, ${brand.b} 58%, ${brand.c})`;

export const pal = {
  light: { bg: '#FBF8F1', card: '#FFFFFF', soft: '#F3EEE3', ink: '#1B140B', ink2: '#5E4E39', ink3: '#8A7A63', line: 'rgba(27,20,11,.09)', shadow: 'rgba(60,40,10,.20)', washA: 'rgba(255,180,58,.34)', washB: 'rgba(255,122,79,.16)', bubble: '#F1ECE2', mine: '#FFE2B3', party: '#2F6BD0', partyWash: 'rgba(47,107,208,.10)', online: '#087A55', sea: '#EFE8D8', land: '#FFFFFF' },
  dark: { bg: '#0D0E12', card: '#15171D', soft: '#1D2028', ink: '#F4ECDD', ink2: '#BFB5A3', ink3: '#9A917F', line: 'rgba(255,255,255,.09)', shadow: 'rgba(0,0,0,.6)', washA: 'rgba(245,158,11,.32)', washB: 'rgba(255,92,122,.10)', bubble: '#1D2028', mine: 'rgba(245,158,11,.26)', party: '#7FB2FF', partyWash: 'rgba(127,178,255,.14)', online: '#34D399', sea: '#0A0B0F', land: '#15171D' },
} as const;

export const font = '"Plus Jakarta Sans", -apple-system, "PingFang TC", "PingFang HK", "Noto Sans TC", "Microsoft JhengHei", sans-serif';

// ───────── 版面單位：畫布就是視窗大小（1:1 像素），所有尺寸乘 u ─────────
type Env = { mode: Mode; w: number; h: number; u: number; portrait: boolean };
const EnvCtx = createContext<Env>({ mode: 'light', w: 1440, h: 900, u: 1, portrait: false });
export const EnvProvider = EnvCtx.Provider;
export const useEnv = () => useContext(EnvCtx);
export const usePal = () => pal[useEnv().mode];
export const makeEnv = (mode: Mode, w: number, h: number): Env => {
  const portrait = h > w * 1.05;
  const u = portrait ? Math.min(w / 820, h / 1500) : Math.min(w / 1500, h / 860);
  return { mode, w, h, u, portrait };
};

// 觸屏設備 30fps：手機瀏覽器跑 60fps 的 blur／3D 轉換會掉幀；桌面 60fps。僅在瀏覽器端載入（dynamic ssr:false）
export const FPS = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 30 : 60;
export const S = (sec: number) => Math.round(sec * FPS);
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIO = Easing.bezier(0.65, 0, 0.35, 1);
/** 局部時間（秒）：放在 Sequence 內 = 這一幕的第幾秒 */
export const useT = () => useCurrentFrame() / FPS;
export const prog = (t: number, a: number, b: number, e: ((x: number) => number) = easeOut) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: e });

// ───────── 動效：模糊升起（Muse 式克制淡入）─────────
export const Reveal: React.FC<{ at?: number; dur?: number; y?: number; blur?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at = 0, dur = 0.9, y = 26, blur = 12, children, style }) => {
  const { u } = useEnv();
  const t = useT();
  const p = prog(t, at, at + dur);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y * u}px)`, filter: p < 1 ? `blur(${(1 - p) * blur}px)` : 'none', ...style }}>{children}</div>;
};

/** 一幕的進出：淡入淡出＋輕微縮放與模糊 */
export const BeatFrame: React.FC<{ dur: number; fin?: number; fout?: number; children: React.ReactNode }> = ({ dur, fin = 0.7, fout = 0.7, children }) => {
  const t = useT();
  const pin = prog(t, 0, fin), pout = fout > 0 ? prog(t, dur - fout, dur, easeIO) : 0;
  const op = Math.min(pin, 1 - pout);
  const sc = 1 + (1 - pin) * 0.02 + pout * -0.015;
  return <div style={{ position: 'absolute', inset: 0, opacity: op, transform: `scale(${sc})`, filter: op < 1 ? `blur(${(1 - op) * 8}px)` : 'none' }}>{children}</div>;
};

export const Headline: React.FC<{ lines: { text: string; accent?: boolean }[][]; size?: number; at?: number; sub?: string }> = ({ lines, size = 150, at = 0.1, sub }) => {
  const { u, portrait } = useEnv();
  const p = usePal();
  const fs = size * u * (portrait ? 0.92 : 1);
  let k = 0;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: font, padding: `0 ${40 * u}px` }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', fontSize: fs, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.14, color: p.ink }}>
          {line.map((tok, j) => {
            const delay = at + 0.12 * k++;
            return <Reveal key={j} at={delay} dur={1} y={34} blur={16}><span style={tok.accent ? { background: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : undefined}>{tok.text}</span></Reveal>;
          })}
        </div>
      ))}
      {sub && <Reveal at={at + 0.12 * k + 0.5} dur={1} style={{ marginTop: 34 * u, fontSize: 32 * u, color: p.ink3, fontWeight: 500, letterSpacing: '-0.01em' }}>{sub}</Reveal>}
    </div>
  );
};

export const Caption: React.FC<{ text: string; at?: number; bottom?: number }> = ({ text, at = 0.6, bottom = 0.1 }) => {
  const { u, h } = useEnv();
  const p = usePal();
  return <div style={{ position: 'absolute', left: 0, right: 0, top: h * (1 - bottom) - 20 * u, textAlign: 'center', fontFamily: font }}><Reveal at={at} style={{ fontSize: 34 * u, fontWeight: 500, color: p.ink2, letterSpacing: '-0.01em', padding: `0 ${32 * u}px` }}>{text}</Reveal></div>;
};

// ───────── 表面 ─────────
export const Card: React.FC<{ w: number; r?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ w, r = 44, style, children }) => {
  const { u } = useEnv();
  const p = usePal();
  return <div style={{ width: w * u, borderRadius: r * u, background: p.card, border: `1px solid ${p.line}`, boxShadow: `0 ${40 * u}px ${100 * u}px -${28 * u}px ${p.shadow}`, fontFamily: font, color: p.ink, ...style }}>{children}</div>;
};

export const seatColors = ['#F4B860', '#F08A6B', '#9DB9F2', '#7FD1AE', '#EE8AA0', '#B9A3EE'];
export const Avatar: React.FC<{ i: number; size: number; label: string; style?: React.CSSProperties }> = ({ i, size, label, style }) => {
  const { u } = useEnv();
  return <div style={{ width: size * u, height: size * u, borderRadius: '50%', display: 'grid', placeItems: 'center', background: seatColors[i % 6], color: '#2A1700', fontWeight: 700, fontSize: size * 0.4 * u, fontFamily: font, flex: 'none', ...style }}>{label}</div>;
};

export const Pill: React.FC<{ children: React.ReactNode; tone?: 'plain' | 'party' | 'accent'; size?: number; style?: React.CSSProperties }> = ({ children, tone = 'plain', size = 28, style }) => {
  const { u } = useEnv();
  const p = usePal();
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 10 * u, padding: `${size * 0.36 * u}px ${size * 0.8 * u}px`, borderRadius: 999, fontSize: size * u, fontWeight: 600, fontFamily: font, whiteSpace: 'nowrap', letterSpacing: '-0.01em' };
  if (tone === 'party') return <span style={{ ...base, background: p.partyWash, color: p.party, ...style }}>{children}</span>;
  if (tone === 'accent') return <span style={{ ...base, background: grad, color: brand.onAmber, ...style }}>{children}</span>;
  return <span style={{ ...base, background: p.soft, color: p.ink2, ...style }}>{children}</span>;
};

// ───────── 極簡單線酒杯（威士忌）：1 條描邊＋1 塊酒液，沒有高光和裝飾 ─────────
export const MonoGlass: React.FC<{ size: number; level: number }> = ({ size, level }) => {
  const { mode, u } = useEnv();
  const p = usePal();
  const id = useId().replace(/:/g, '');
  const shape = 'M34 28 L146 28 L138 164 Q137 174 127 174 L53 174 Q43 174 42 164 Z';
  const top = 174 - 128 * level;
  return (
    <svg viewBox="0 0 180 200" width={size * u} height={size * u * 200 / 180} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id={`c${id}`}><path d={shape} /></clipPath>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F6B24D" /><stop offset="1" stopColor="#D9791F" /></linearGradient>
      </defs>
      <g clipPath={`url(#c${id})`}><rect x="30" y={top} width="120" height={180 - top} fill={`url(#g${id})`} opacity={mode === 'dark' ? 0.95 : 0.9} /></g>
      <path d={shape} fill="none" stroke={p.ink} strokeOpacity={0.8} strokeWidth="3" strokeLinejoin="round" />
      {level > 0.4 && <><rect x="62" y="84" width="34" height="34" rx="8" fill="none" stroke={p.ink} strokeOpacity="0.55" strokeWidth="2.5" transform="rotate(-9 79 101)" /><rect x="92" y="116" width="32" height="32" rx="8" fill="none" stroke={p.ink} strokeOpacity="0.55" strokeWidth="2.5" transform="rotate(11 108 132)" /></>}
    </svg>
  );
};

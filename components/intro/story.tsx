'use client';

// 首頁自動播放故事線：打開即播、循環。真機錄屏畫面 + 手機框 + 鏡頭推拉，沒有 emoji、沒有手繪示意。
// 每一幕：左（或上）標題，右（或下）一部手機，手機內按時間切換真實截圖，並可局部放大。
import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { BeatFrame, EnvProvider, FPS, Headline, Mode, Reveal, S, clamp, easeIO, font, grad, makeEnv, prog, useEnv, usePal, useT } from './kit';

type Zoom = { s: number; x: number; y: number; from: number; to: number }; // x,y = 縮放原點（%）
type Shot = { src: string; at: number; zoom?: Zoom };
type Scene = { id: string; label: string; dur: number; head: { text: string; accent?: boolean }[][]; sub: string; shots: Shot[]; dark?: boolean; flip?: boolean };

const shot = (n: string) => `/intro/shots/${n}.jpg`;

export const SCENES: Scene[] = [
  { id: 'checkin', label: 'Check in', dur: 8.6, head: [[{ text: 'Snap it.' }], [{ text: 'Pin it to tonight.', accent: true }]], sub: 'Snapshots disappear after 24 hours. Posts stay for good.',
    shots: [{ src: shot('19-checkin-camera'), at: 0, zoom: { s: 1.55, x: 50, y: 90, from: 0.6, to: 2.4 } }, { src: shot('21-checkin-editor'), at: 2.6 }, { src: shot('23-checkin-preview'), at: 4.8 }, { src: shot('24-checkin-published-map'), at: 6.6, zoom: { s: 1.7, x: 50, y: 40, from: 7.0, to: 8.4 } }] },
  { id: 'ai', label: 'AI search', dur: 6.8, flip: true, head: [[{ text: 'Say it once.' }], [{ text: 'Find who’s out.', accent: true }]], sub: 'Search users, bars, meetups and posts in one sentence.',
    shots: [{ src: shot('04-ai-thinking'), at: 0 }, { src: shot('05-ai-results'), at: 3.6 }] },
  { id: 'chat', label: 'Chat', dur: 6.2, head: [[{ text: 'Say hello.' }], [{ text: 'Make a plan.', accent: true }]], sub: 'See why you match, then add a friend.',
    shots: [{ src: shot('07-chat'), at: 0 }, { src: shot('08-match-profile'), at: 3.2 }] },
  { id: 'taste', label: 'Taste', dur: 6.2, flip: true, head: [[{ text: 'Drink more.' }], [{ text: 'Know your taste.', accent: true }]], sub: 'Every check-in builds your taste card.',
    shots: [{ src: shot('09-taste-card'), at: 0 }, { src: shot('10-taste-radar'), at: 3.2 }] },
  { id: 'cheers', label: 'Cheers', dur: 5.6, dark: true, head: [[{ text: 'Raise a glass.', accent: true }]], sub: 'Draw tonight’s drink and invite friends.',
    shots: [{ src: shot('11-cheers-smoke'), at: 0 }, { src: shot('12-cheers-bottle'), at: 2.8 }] },
  { id: 'nearby', label: 'Nearby', dur: 6.2, flip: true, head: [[{ text: 'Where tonight?' }], [{ text: 'We’ll walk you there.', accent: true }]], sub: 'Nearby bars with distance and a walking route.',
    shots: [{ src: shot('13-nearby-bars'), at: 0 }, { src: shot('14-walk-route'), at: 3.2 }] },
  { id: 'games', label: 'Games', dur: 6.2, head: [[{ text: 'Play a round.', accent: true }]], sub: 'Who’s the Spy, Liar’s Dice. Bump phones to join.',
    shots: [{ src: shot('17-games-hub'), at: 0 }, { src: shot('18-bump-to-join'), at: 3.4 }] },
  { id: 'ivy', label: 'Ivy', dur: 4.8, flip: true, head: [[{ text: 'Late night chat.' }], [{ text: 'Ivy’s behind the bar.', accent: true }]], sub: 'Your AI bartender. Hold to talk.',
    shots: [{ src: shot('15-ivy-bartender'), at: 0 }] },
];

const TITLE = 3.6;
const OVERLAP = 0.6;
const END_DUR = 6.0;
const starts: number[] = [];
{ let t = TITLE - OVERLAP; for (const s of SCENES) { starts.push(t); t += s.dur - OVERLAP; } starts.push(t); }
export const SCENE_STARTS = starts;
export const END_SEC = starts[SCENES.length];
export const TOTAL_SEC = END_SEC + END_DUR;
export const TOTAL_FRAMES = S(TOTAL_SEC);
export const END_FRAME = S(END_SEC + 1.6);
export const CHAPTERS = [{ label: 'Intro', from: 0 }, ...SCENES.map((s, i) => ({ label: s.label, from: starts[i] })), { label: 'Tonight', from: END_SEC }];

// ───────── 背景：只有一道柔光 ─────────
const Wash: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const p = usePal();
  const cx = 50 + 18 * Math.sin(t * 0.3);
  return (
    <AbsoluteFill style={{ background: p.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(80% 60% at ${cx}% 115%, ${p.washA}, transparent 70%), radial-gradient(55% 45% at ${100 - cx}% 8%, ${p.washB}, transparent 72%)`, opacity: 0.8 }} />
    </AbsoluteFill>
  );
};

// ───────── 手機框 + 真實截圖 ─────────
const SRC_W = 1170, SRC_H = 2532, CROP = 150; // 截圖頂部 150px 是狀態列（含錄屏紅膠囊），裁掉
const ASPECT = (SRC_H - CROP) / SRC_W;
export const PHONE_ASPECT = ASPECT;
const NAV_BAND = 84; // px：頂部導航（含右上下載按鈕）高度＋間距

const Screen: React.FC<{ shots: Shot[]; W: number; t: number }> = ({ shots, W, t }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
    {shots.map((s, i) => {
      const o = i === 0 ? 1 : prog(t, s.at, s.at + 0.7, easeIO);
      const z = s.zoom;
      const sc = z ? 1 + (z.s - 1) * prog(t, z.from, z.to, easeIO) : 1;
      // 淡入時新畫面輕微由大變小，避免硬切
      const settle = i === 0 ? 0 : (1 - o) * 0.03;
      return (
        <div key={s.src} style={{ position: 'absolute', inset: 0, opacity: o, transform: `scale(${sc + settle})`, transformOrigin: z ? `${z.x}% ${z.y}%` : '50% 50%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 淡入／縮放動畫逐幀控制，不走 next/image */}
          <img src={s.src} alt="" style={{ position: 'absolute', left: 0, top: -(CROP / SRC_W) * W, width: W }} />
        </div>
      );
    })}
  </div>
);

const Phone: React.FC<{ W: number; shots: Shot[]; t: number; shadow?: boolean }> = ({ W, shots, t, shadow = true }) => {
  const bz = W * 0.03;
  const sw = W;
  const sh = W * ASPECT;
  return (
    <div style={{ position: 'relative', width: sw + bz * 2, height: sh + bz * 2, borderRadius: W * 0.17, background: '#0A0A0C', boxShadow: `0 0 0 ${Math.max(1, W * 0.004)}px rgba(255,255,255,.16), ${shadow ? `0 ${W * 0.16}px ${W * 0.34}px -${W * 0.08}px rgba(20,10,0,.55)` : 'none'}`, padding: bz }}>
      <div style={{ position: 'relative', width: sw, height: sh, borderRadius: W * 0.14, overflow: 'hidden' }}>
        <Screen shots={shots} W={sw} t={t} />
        <div style={{ position: 'absolute', left: '50%', top: W * 0.028, width: W * 0.28, height: W * 0.08, marginLeft: -W * 0.14, borderRadius: 999, background: '#000' }} />
        {/* 玻璃反光：只一條斜向淡光 */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 28%)', pointerEvents: 'none' }} />
      </div>
    </div>
  );
};

// ───────── 一幕：標題 + 手機 ─────────
const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  const env = useEnv();
  const { w, h, u, portrait } = env;
  const t = useT();
  const p = usePal();
  const rise = prog(t, 0.05, 1.5);
  const float = Math.sin(t * 0.9) * 0.006;
  const drift = interpolate(t, [0, scene.dur], [0, 1], clamp);

  const band = NAV_BAND * Math.max(1, Math.min(1.2, h / 800)); // 導航／下載按鈕占用的頂部帶，內容不得進入
  const avail = h - band - h * 0.04;
  const phoneH = portrait ? Math.min(h * 0.58, (w * 0.7) * (ASPECT + 0.06)) : Math.min(h * 0.84, avail);
  const W = phoneH / (ASPECT + 0.06);
  const phoneCx = portrait ? w / 2 : scene.flip ? w * 0.3 : w * 0.7;
  const phoneTop = portrait ? h - phoneH - h * 0.045 : band + (avail - phoneH) / 2;
  const textX = portrait ? w / 2 : scene.flip ? w * 0.56 : w * 0.07;
  const textW = portrait ? w * 0.9 : w * 0.4;
  const fs = (portrait ? 58 : 70) * u * (portrait ? 1.0 : 1);

  return (
    <BeatFrame dur={scene.dur} fin={0.8} fout={0.8}>
      {scene.dark && <AbsoluteFill style={{ background: 'radial-gradient(70% 70% at 50% 60%, #1A1208, #08070A)', opacity: prog(t, 0, 0.9) }} />}
      <div style={{ position: 'absolute', left: portrait ? 0 : textX, top: portrait ? band : 0, width: portrait ? w : textW, height: portrait ? h * 0.26 : h, display: 'flex', flexDirection: 'column', justifyContent: portrait ? 'flex-start' : 'center', alignItems: portrait ? 'center' : 'flex-start', textAlign: portrait ? 'center' : 'left', fontFamily: font, ...(portrait ? { padding: `0 ${w * 0.05}px` } : {}) }}>
        {scene.head.map((line, i) => (
          <Reveal key={i} at={0.25 + i * 0.22} dur={1} y={34} blur={14}>
            <div style={{ fontSize: fs, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.16, color: p.ink }}>
              {line.map((tok, j) => <span key={j} style={tok.accent ? { background: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : undefined}>{tok.text}</span>)}
            </div>
          </Reveal>
        ))}
        <Reveal at={0.25 + scene.head.length * 0.22 + 0.35} dur={1} style={{ marginTop: 26 * u, fontSize: (portrait ? 26 : 28) * u, fontWeight: 500, color: p.ink2, letterSpacing: '-0.005em', lineHeight: 1.5 }}>{scene.sub}</Reveal>
      </div>
      <div style={{ position: 'absolute', left: phoneCx - (W * 1.06) / 2, top: phoneTop, transform: `translateY(${(1 - rise) * h * 0.14 + float * h}px) perspective(${W * 6}px) rotateY(${(scene.flip ? 1 : -1) * ((1 - rise) * 16 + drift * -3)}deg) scale(${0.96 + 0.04 * rise + drift * 0.025})`, opacity: rise, filter: rise < 1 ? `blur(${(1 - rise) * 10}px)` : 'none' }}>
        <Phone W={W} shots={scene.shots} t={t} />
      </div>
    </BeatFrame>
  );
};

// ───────── 開場：只有一句話 ─────────
const Title: React.FC = () => (
  <BeatFrame dur={TITLE} fin={0.4} fout={0.8}>
    <Headline lines={[[{ text: 'What to drink' }], [{ text: 'tonight?', accent: true }]]} size={150} sub="Discover bars, follow friends’ trails and meet over a drink." />
  </BeatFrame>
);

// ───────── 結尾：三部手機扇形 + 一句話，下載按鈕由頁面 DOM 提供 ─────────
const End: React.FC = () => {
  const { w, h, u, portrait } = useEnv();
  const t = useT();
  const p = usePal();
  const PW = portrait ? w * 0.34 : Math.min(h * 0.3, w * 0.16);
  const items = [
    { src: shot('24-checkin-published-map'), dx: -1.12, rot: -9, dy: 0.06 },
    { src: shot('07-chat'), dx: 0, rot: 0, dy: 0 },
    { src: shot('18-bump-to-join'), dx: 1.12, rot: 9, dy: 0.06 },
  ];
  return (
    <BeatFrame dur={END_DUR} fin={0.9} fout={0}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: Math.max(NAV_BAND + 8, portrait ? h * 0.1 : h * 0.12), textAlign: 'center', fontFamily: font }}>
        <Reveal at={0.2} dur={1.1} y={30} blur={14}><div style={{ fontSize: (portrait ? 70 : 92) * u, fontWeight: 600, letterSpacing: '-0.04em', color: p.ink }}>See you <span style={{ background: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>at the bar</span></div></Reveal>
        <Reveal at={0.8} dur={1} style={{ marginTop: 18 * u, fontSize: 24 * u, color: p.ink3, fontWeight: 500 }}>You must be 18 or over to drink. Never drink and drive.</Reveal>
      </div>
      {items.map((it, i) => {
        const k = prog(t, 0.5 + i * 0.18, 1.8 + i * 0.18);
        const ph = PW * (ASPECT + 0.06);
        return (
          <div key={it.src} style={{ position: 'absolute', left: w / 2 + it.dx * PW * 1.05 - PW / 2, top: h - ph * (0.62 + (1 - k) * 0.4) + it.dy * h, transform: `rotate(${it.rot * k}deg)`, transformOrigin: '50% 100%', opacity: k }}>
            <Phone W={PW} shots={[{ src: it.src, at: 0 }]} t={t} />
          </div>
        );
      })}
    </BeatFrame>
  );
};

export const Story: React.FC<{ mode: Mode; w: number; h: number }> = ({ mode, w, h }) => {
  const env = makeEnv(mode, w, h);
  return (
    <EnvProvider value={env}>
      <AbsoluteFill>
        <Wash />
        <Sequence from={0} durationInFrames={S(TITLE)}><Title /></Sequence>
        {SCENES.map((sc, i) => (
          <Sequence key={sc.id} from={S(starts[i])} durationInFrames={S(sc.dur)} layout="none">
            {sc.dark ? <EnvProvider value={{ ...env, mode: 'dark' }}><SceneView scene={sc} /></EnvProvider> : <SceneView scene={sc} />}
          </Sequence>
        ))}
        <Sequence from={S(END_SEC)} durationInFrames={S(END_DUR)}><End /></Sequence>
      </AbsoluteFill>
    </EnvProvider>
  );
};

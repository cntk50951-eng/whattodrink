"use client";

import { getImageProps } from "next/image";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import type { AppLocale } from "@/i18n/routing";

import { FPS, S } from "../intro/kit";
import { INTRO_COPY, type IntroCopy, type SceneId } from "./copy";
import { INTRO_BRAND } from "./brand";
import { buildBrowseStops } from "./browse";
import { cameraAt, phraseAt, screenAt, smoothProgress, type CameraPath, type CameraTarget, type ScreenTransition } from "./motion";
import { ARTWORK_SCREENS, artworkSrc, type ArtworkId } from "./artwork";
import s from "./intro-next.module.css";

type MotionStyle = CSSProperties & Record<`--${string}`, string | number>;
type CaptureId = ArtworkId;
type Shot = { name: CaptureId; at: number; target?: CameraTarget };
type Scene = { id: SceneId; dur: number; shots: Shot[]; target: CameraTarget; path?: CameraPath; transition?: ScreenTransition; phraseTimes?: number[] };
const TITLE = 7;
const OVERLAP = 0.6;
const END_DUR = 7;

// UI follows the iOS screenshots and Swift views. Labels come from its xcstrings;
// demo photos and captions are deliberately curated for the promotional story.
export const CAPTURE_NAMES = ARTWORK_SCREENS.map((screen) => screen.id);
export const captureSrc = artworkSrc;
export const SCREEN_SIZES = "(max-width: 760px) 65vw, 42vh";
export function captureImageProps(name: CaptureId, locale: AppLocale, focus = false): ReturnType<typeof getImageProps>["props"] {
  return getImageProps({ src: captureSrc(name, locale), alt: "", width: 1170, height: 2532, sizes: focus ? "(max-width: 760px) 95vw, 40vw" : SCREEN_SIZES, loading: "eager" }).props;
}
const screenProps = Object.fromEntries((["zh-Hant", "zh-Hans", "en"] as const).map((locale) => [locale, Object.fromEntries(CAPTURE_NAMES.map((name) => [name, captureImageProps(name, locale)]))])) as Record<AppLocale, Record<CaptureId, ReturnType<typeof captureImageProps>>>;

export const SCENES: Scene[] = [
  { id: "capture", path: "lift", transition: "lift", dur: 7.5, shots: [{ name: "camera", at: 0 }], target: { x: 50, y: 17, zoom: 1.55 } },
  { id: "edit", path: "arc", transition: "lift", dur: 8, shots: [{ name: "editor", at: 0 }], target: { x: 50, y: 91, zoom: 1.6 } },
  { id: "map", path: "glide", transition: "slide", dur: 9, shots: [{ name: "map", at: 0 }, { name: "detail", at: 4.3, target: { x: 50, y: 65, zoom: 1.3 } }], target: { x: 50, y: 44, zoom: 1.4 } },
  { id: "ivy", path: "arc", transition: "dissolve", dur: 7.5, shots: [{ name: "ivy-bar", at: 0 }], target: { x: 50, y: 76, zoom: 1.4 } },
  { id: "dice", path: "arc", transition: "dissolve", dur: 11, shots: [{ name: "dice-cups", at: 0 }, { name: "dice-peek", at: 3.5, target: { x: 50, y: 51, zoom: 1.35 } }, { name: "dice-cups", at: 7.3, target: { x: 50, y: 87, zoom: 1.45 } }], target: { x: 50, y: 54, zoom: 1.35 } },
  { id: "cocktail", path: "lift", transition: "lift", dur: 13, shots: [{ name: "cocktail-book", at: 0 }, { name: "cocktail-recipe", at: 2.6, target: { x: 50, y: 63, zoom: 1.25 } }, { name: "cocktail-step", at: 5.8, target: { x: 50, y: 63, zoom: 1.25 } }, { name: "cocktail-done", at: 9.5, target: { x: 50, y: 86, zoom: 1.25 } }], target: { x: 50, y: 55, zoom: 1.2 } },
  { id: "party", phraseTimes: [0, 3.8, 5.9], path: "glide", transition: "slide", dur: 8, shots: [{ name: "party", at: 0 }, { name: "party-detail", at: 3.8, target: { x: 50, y: 52, zoom: 1.4 } }], target: { x: 50, y: 68, zoom: 1.25 } },
  { id: "trail", phraseTimes: [0, 1.3, 3.2, 6.9], path: "glide", transition: "lift", dur: 11.5, shots: [{ name: "trail", at: 0 }, { name: "trail-map", at: 3.2, target: { x: 50, y: 46, zoom: 1.2 } }, { name: "trail-replay", at: 6.9, target: { x: 50, y: 77, zoom: 1.25 } }], target: { x: 50, y: 74, zoom: 1.35 } },
  { id: "meet", path: "lift", transition: "lift", dur: 7.5, shots: [{ name: "meet", at: 0 }], target: { x: 50, y: 58, zoom: 1.3 } },
  { id: "tonight", phraseTimes: [0, 1.4, 3.3], path: "arc", transition: "dissolve", dur: 6.5, shots: [{ name: "tonight", at: 0 }], target: { x: 50, y: 83, zoom: 1.3 } },
  { id: "cheers", phraseTimes: [0, 2.3, 4.7], path: "lift", transition: "slide", dur: 7, shots: [{ name: "detail", at: 0 }, { name: "cheers", at: 2.3, target: { x: 50, y: 62, zoom: 1.4 } }], target: { x: 50, y: 83, zoom: 1.3 } },
  { id: "home", phraseTimes: [0, 3.8, 5.9], path: "glide", transition: "slide", dur: 8, shots: [{ name: "home", at: 0 }, { name: "profile", at: 3.8, target: { x: 50, y: 71, zoom: 1.3 } }], target: { x: 50, y: 91, zoom: 1.4 } },
];
const starts: number[] = [];
let next = TITLE - OVERLAP;
for (const scene of SCENES) { starts.push(next); next += scene.dur - OVERLAP; }
export const END_SEC = next;
export const TOTAL_SEC = END_SEC + END_DUR;
export const TOTAL_FRAMES = S(TOTAL_SEC);
export const BROWSE_STOPS = buildBrowseStops(SCENES, starts, END_SEC, FPS, TOTAL_FRAMES);

function Atmosphere(): ReactElement {
  const t = useCurrentFrame() / FPS;
  return (
    <div className={s.atmosphere} style={{ "--light-x": `${55 + Math.sin(t * 0.17) * 16}%`, "--orbit": `${t * 1.3}deg` } as MotionStyle}>
      <div className={s.grid} /><div className={s.orbit}><i /><i /><i /></div>
      <svg className={s.constellation} viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M0 650L260 510L440 580L720 280L1010 390L1400 150M260 510L310 210L720 280L890 70M440 580L930 730L1010 390L1290 610" />
        {[[260,510],[440,580],[720,280],[1010,390],[310,210],[930,730],[1290,610]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3" />)}
      </svg><div className={s.vignette} />
    </div>
  );
}

function Frame({ dur, children, final = false }: { dur: number; children: ReactNode; final?: boolean }): ReactElement {
  const t = useCurrentFrame() / FPS;
  const entrance = smoothProgress(t, 0, OVERLAP);
  const exit = final ? 0 : smoothProgress(t, dur - OVERLAP, dur);
  return <div className={s.sceneFrame} style={{ "--opacity": Math.min(entrance, 1 - exit), "--rise": `${(1 - entrance) * 4 - exit * 3}px` } as MotionStyle}>{children}</div>;
}

function Phone({ shots, t, locale, camera, side = 1, transition = "dissolve" }: { shots: Shot[]; t: number; locale: AppLocale; camera?: ReturnType<typeof cameraAt>; side?: -1 | 1; transition?: ScreenTransition }): ReactElement {
  return (
    <div className={s.phone}>
      <div className={s.phoneScreen}>
        <div className={s.screenZoom} style={{ "--screen-x": `${camera?.imageX ?? 0}%`, "--screen-y": `${camera?.imageY ?? 0}%`, "--screen-zoom": camera?.zoom ?? 1 } as MotionStyle}>
          {shots.map((item, i) => {
            const pose = screenAt(t, item.at, shots[i + 1]?.at, i === 0, side, transition);
            return <div key={`${item.name}-${item.at}`} className={s.screenLayer} style={{ "--screen-opacity": pose.opacity, "--page-x": `${pose.x}%`, "--page-y": `${pose.y}%`, "--page-scale": pose.scale } as MotionStyle}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Optimized responsive images without per-frame React image state. */}
              <img {...screenProps[locale][item.name]} alt="" draggable={false} />
            </div>;
          })}
        </div>
        <div className={s.island} /><div className={s.reflection} style={{ "--sheen": `${camera?.sheen ?? 0}%` } as MotionStyle} />
      </div>
    </div>
  );
}

function Reveal({ children, t, at = 0, inline = false }: { children: ReactNode; t: number; at?: number; inline?: boolean }): ReactElement {
  const enter = smoothProgress(t, at, at + 0.85);
  const Tag = inline ? "span" : "div";
  return <Tag style={{ display: "block", opacity: enter, transform: `translateY(${(1 - enter) * 18}px)`, filter: `blur(${(1 - enter) * 4}px)` }}>{children}</Tag>;
}

function NarrativeDetail({ text, t, scene }: { text: string; t: number; scene: Scene }): ReactElement {
  const phrases = text.split(" → ");
  const cuts = scene.phraseTimes ?? scene.shots.map((shot) => shot.at);
  return <div className={`${s.featureDetail} ${s.narrativeDetail}`}>
    {phrases.map((phrase, i) => <span key={phrase} className={s.phrasePair}>
      {i > 0 && <i className={s.phraseArrow}>→</i>}
      <span className={s.phrase} style={{ "--emphasis": phrases.length === 1 ? 1 : phraseAt(t, i, phrases.length, scene.dur, cuts) } as MotionStyle}>{phrase}</span>
    </span>)}
  </div>;
}

function SceneView({ scene, copy, locale, side, portrait }: { scene: Scene; copy: IntroCopy; locale: AppLocale; side: -1 | 1; portrait: boolean }): ReactElement {
  const t = useCurrentFrame() / FPS;
  const text = copy.scenes[scene.id];
  let target = scene.target;
  for (const shot of scene.shots) {
    if (!shot.target) continue;
    const blend = smoothProgress(t, shot.at, shot.at + 1.45);
    target = { x: target.x + (shot.target.x - target.x) * blend, y: target.y + (shot.target.y - target.y) * blend, zoom: target.zoom + (shot.target.zoom - target.zoom) * blend };
  }
  const camera = cameraAt(t, scene.dur, target, side, portrait, scene.shots.map((shot) => shot.at), scene.path);
  return (
    <Frame dur={scene.dur}>
      <div className={s.featureLayout} data-side={side === -1 ? "left" : "right"}>
        <div className={s.featureCopy}>
          <Reveal t={t} at={0.1}><div className={s.eyebrow}><i className={s.liveDot} />{text.eyebrow}</div></Reveal>
          <h2><Reveal inline t={t} at={0.25}>{text.title}</Reveal><Reveal inline t={t} at={0.55}><span className={`${s.accent} ${s.emphasis}`} style={{ "--underline": smoothProgress(t, 1.05, 2.1) } as MotionStyle}>{text.accent}</span></Reveal></h2>
          <p>{text.sub.split("\n").map((line, i) => <Reveal inline key={line} t={t} at={0.95 + i * 0.3}>{line}</Reveal>)}</p>
          <Reveal t={t} at={1.35}><NarrativeDetail text={text.detail} t={t} scene={scene} /></Reveal>
        </div>
        <div className={s.productStage}>
          <div className={s.phoneHalo} style={{ "--halo-scale": 1 + camera.light * 0.06, "--halo-opacity": 0.46 + camera.light * 0.18, "--halo-x": `${camera.lightX}%`, "--halo-y": `${camera.lightY}%` } as MotionStyle} />
          <div className={s.cameraRig} style={{ "--rig-x": `${camera.slide}cqw`, "--rig-y": `${camera.rise}cqh`, "--rig-scale": camera.scale, "--rig-yaw": `${camera.yaw}deg`, "--rig-roll": `${camera.roll}deg` } as MotionStyle}>
            <Phone shots={scene.shots} t={t} locale={locale} camera={camera} side={side} transition={scene.transition} />
          </div>
          <div className={s.focusLabel} style={{ "--focus-opacity": smoothProgress(t, 2.3, 4.2) * (1 - smoothProgress(t, scene.dur - 2, scene.dur - 0.6)), "--focus-rise": `${(1 - camera.light) * 5}px` } as MotionStyle}><span className={s.liveDot} />{text.focus}<span>↗</span></div>
        </div>
      </div>
    </Frame>
  );
}

function HeroPhones({ copy, t, locale }: { copy: IntroCopy; t: number; locale: AppLocale }): ReactElement {
  const drift = smoothProgress(t, 1.9, 6.8);
  return (
    <div className={`${s.productStage} ${s.heroProducts}`}>
      <div className={s.phoneHalo} />
      <div className={s.heroBack} style={{ opacity: smoothProgress(t, 0.15, 1.5), transform: `translate(-87%, -46%) rotate(${-19 + smoothProgress(t, 0.15, 1.9) * 9 + drift * 0.8}deg) scale(${0.68 + smoothProgress(t, 0.15, 1.9) * 0.15 - drift * 0.01})` }}><Phone shots={[{ name: "ivy-bar", at: 0 }]} t={t} locale={locale} /><span className={s.phoneTag}>{copy.hero.ivy}</span></div>
      <div className={s.heroFront} style={{ opacity: smoothProgress(t, 0.4, 1.7), transform: `translate(-17%, ${-40 - smoothProgress(t, 0.4, 2.1) * 10}%) rotate(${14 - smoothProgress(t, 0.4, 2.1) * 8 - drift * 0.8}deg) scale(${0.88 + smoothProgress(t, 0.4, 2.1) * 0.12 + drift * 0.015})` }}><Phone shots={[{ name: "detail", at: 0 }]} t={t} locale={locale} /><span className={s.phoneTag}>{copy.hero.post}</span></div>
    </div>
  );
}

export const BRAND_IMAGE_PROPS = getImageProps({ src: INTRO_BRAND.opening, alt: INTRO_BRAND.label, width: 1400, height: 1400, sizes: "(max-width: 760px) 84vw, 42vw", loading: "eager", fetchPriority: "high" }).props;

function BrandOpening({ t }: { t: number }): ReactElement {
  const enter = smoothProgress(t, 0.1, 1.6);
  const drift = smoothProgress(t, 1.6, TITLE);
  return <div className={s.productStage}>
    <div className={s.brandArtwork} style={{ "--brand-opacity": enter, "--brand-y": `${(1 - enter) * 16 - drift * 3}px`, "--brand-scale": 0.97 + enter * 0.03 + drift * 0.006 } as MotionStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Responsive optimized art in a frame-driven composition. */}
      <img {...BRAND_IMAGE_PROPS} alt={INTRO_BRAND.label} draggable={false} />
    </div>
  </div>;
}

function Title({ copy }: { copy: IntroCopy }): ReactElement {
  const t = useCurrentFrame() / FPS;
  return (
    <Frame dur={TITLE}>
      <div className={`${s.featureLayout} ${s.titleLayout}`}>
        <div className={s.featureCopy}>
          <Reveal t={t} at={0.1}><div className={s.eyebrow}><i className={s.liveDot} />{copy.hero.eyebrow}</div></Reveal>
          <h1><Reveal inline t={t} at={0.25}>{copy.hero.title}</Reveal><Reveal inline t={t} at={0.6}><span className={s.accent}>{copy.hero.accent}</span></Reveal></h1>
          <p>{copy.hero.sub.split("\n").map((line, i) => <Reveal inline key={line} t={t} at={1 + i * 0.25}>{line}</Reveal>)}</p>
          <Reveal t={t} at={1.4}><div className={s.heroChips}><span>{copy.hero.post}</span><span>{copy.hero.ivy}</span></div></Reveal>
        </div>
        <BrandOpening t={t} />
      </div>
    </Frame>
  );
}

function End({ copy, locale }: { copy: IntroCopy; locale: AppLocale }): ReactElement {
  const t = useCurrentFrame() / FPS;
  return (
    <Frame dur={END_DUR} final>
      <div className={`${s.featureLayout} ${s.titleLayout}`}>
        <div className={s.featureCopy}>
          <Reveal t={t} at={0.1}><div className={s.eyebrow}><i className={s.liveDot} />{copy.end.eyebrow}</div></Reveal>
          <h2><Reveal inline t={t} at={0.25}>{copy.end.title}</Reveal><Reveal inline t={t} at={0.6}><span className={s.accent}>{copy.end.accent}</span></Reveal></h2>
          <Reveal t={t} at={1}><p>{copy.end.sub}</p></Reveal>
          <Reveal t={t} at={1.4}><div className={s.heroChips}><span>{copy.hero.post}</span><span>{copy.hero.ivy}</span></div></Reveal>
        </div>
        <HeroPhones copy={copy} t={t} locale={locale} />
      </div>
    </Frame>
  );
}

export function Story({ w, h, locale }: { w: number; h: number; locale: AppLocale }): ReactElement {
  const copy = INTRO_COPY[locale];
  return (
    <AbsoluteFill className={s.story} data-locale={locale} style={{ "--canvas-w": `${w}px`, "--canvas-h": `${h}px` } as MotionStyle}>
      <Atmosphere />
      <Sequence durationInFrames={S(TITLE)}><Title copy={copy} /></Sequence>
      {SCENES.map((scene, i) => <Sequence key={scene.id} from={S(starts[i])} durationInFrames={S(scene.dur)} layout="none"><SceneView scene={scene} copy={copy} locale={locale} side={i % 2 === 0 ? 1 : -1} portrait={w <= 760} /></Sequence>)}
      <Sequence from={S(END_SEC)} durationInFrames={S(END_DUR)}><End copy={copy} locale={locale} /></Sequence>
    </AbsoluteFill>
  );
}

import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

/**
 * UR1.5 homepage hero — doodle look per 07-hand-drawn-doodle.html.
 *
 * Procedural mini doodle (mug + foam + cheers bubble) drawn inline so it
 * follows theme tokens via CSS vars — no hardcoded colors (AC3).
 */
export async function Hero() {
  const t = await getTranslations("hero");

  return (
    <section aria-label={t("title")}>
      <Container className="py-10 md:py-16">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="font-hand text-xl text-(--doodle-red) md:text-2xl">
              {t("eyebrow")}
            </p>
            <h1 className="font-hand mt-2 text-6xl leading-none font-bold tracking-tight text-balance md:text-8xl">
              {t("title")}
            </h1>
            <svg
              viewBox="0 0 200 12"
              className="mt-2 w-44 md:w-56"
              aria-hidden
            >
              <path
                d="M4 8 Q 30 2 55 7 T 106 7 T 157 7 T 196 6"
                fill="none"
                stroke="var(--doodle-red)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-muted-foreground mt-4 max-w-prose text-base md:text-lg">
              {t("subtitle")}
            </p>
            <div className="mt-6">
              <Button
                size="lg"
                nativeButton={false}
                render={<a href="#cards" />}
              >
                {t("cta")}
              </Button>
            </div>
          </div>

          <div aria-hidden className="mx-auto w-full max-w-md">
            <svg
              viewBox="0 0 300 260"
              width="100%"
              role="img"
              aria-label="doodle beer mug"
            >
              <defs>
                <filter id="doodle-wobble" x="-5%" y="-5%" width="110%" height="110%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.04"
                    numOctaves="2"
                  />
                  <feDisplacementMap in="SourceGraphic" scale="2.5" />
                </filter>
              </defs>
              {/* Barley sprig, top left */}
              <g
                filter="url(#doodle-wobble)"
                fill="none"
                stroke="var(--border)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M 40 18 Q 39 44 40 68" strokeWidth="2" />
                <path d="M 39 30 Q 28 28 24 36 Q 32 40 39 36 Z" fill="var(--primary)" />
                <path d="M 41 30 Q 52 28 56 36 Q 48 40 41 36 Z" fill="var(--mustard-soft)" />
                <path d="M 39 46 Q 28 44 24 52 Q 32 56 39 52 Z" fill="var(--mustard-soft)" />
                <path d="M 41 46 Q 52 44 56 52 Q 48 56 41 52 Z" fill="var(--primary)" />
              </g>
              {/* Hop cone, left */}
              <g
                filter="url(#doodle-wobble)"
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M 30 150 Q 28 162 29 172" />
                <path d="M 29 170 Q 18 172 15 184 Q 24 187 29 180 Z" fill="var(--secondary)" />
                <path d="M 31 170 Q 42 172 45 184 Q 36 187 31 180 Z" fill="var(--teal-soft)" />
                <path d="M 29 184 Q 20 190 22 200 Q 29 199 31 190 Z" fill="var(--primary)" />
              </g>
              {/* Scattered bubbles */}
              <g filter="url(#doodle-wobble)">
                <circle cx="252" cy="100" r="5" fill="var(--accent)" />
                <circle cx="268" cy="140" r="3.5" fill="var(--secondary)" />
                <circle
                  cx="248"
                  cy="180"
                  r="6"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                />
                <circle cx="62" cy="96" r="4" fill="var(--secondary)" />
                <circle cx="20" cy="130" r="3" fill="var(--accent)" />
              </g>
              <g
                filter="url(#doodle-wobble)"
                fill="none"
                stroke="var(--border)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Mug body */}
                <path
                  d="M 95 95 L 92 210 Q 92 222 104 222 L 186 222 Q 198 222 198 210 L 195 95 Z"
                  fill="var(--card)"
                />
                {/* Foam */}
                <path
                  d="M 88 95 Q 86 72 106 68 Q 112 55 130 63 Q 146 52 162 63 Q 178 54 192 65 Q 202 68 202 95 Z"
                  fill="var(--card)"
                />
                {/* Foam bump curls */}
                <g strokeWidth="1.5">
                  <path d="M 112 70 Q 116 62 124 66" />
                  <path d="M 140 64 Q 146 56 154 62" />
                  <path d="M 168 66 Q 174 58 182 64" />
                </g>
                {/* Liquid */}
                <path
                  d="M 94 130 L 92 208 Q 92 218 104 218 L 186 218 Q 196 218 196 208 L 194 130 Z"
                  fill="var(--primary)"
                  strokeWidth="2"
                />
                {/* Glass highlight waves */}
                <g strokeWidth="2" opacity="0.5">
                  <path d="M 118 145 Q 112 175 120 205" />
                  <path d="M 138 145 Q 132 175 140 205" />
                </g>
                {/* Handle — double line */}
                <path d="M 198 142 Q 222 142 222 168 Q 222 194 198 194" />
                <path
                  d="M 205 152 Q 214 152 214 168 Q 214 184 205 184"
                  strokeWidth="1.5"
                  opacity="0.7"
                />
                {/* Bubbles in liquid */}
                <circle
                  cx="125"
                  cy="165"
                  r="5"
                  fill="var(--card)"
                  strokeWidth="1.5"
                />
                <circle
                  cx="155"
                  cy="185"
                  r="6"
                  fill="var(--card)"
                  strokeWidth="1.5"
                />
                {/* Cheers bubble */}
                <ellipse
                  cx="238"
                  cy="48"
                  rx="52"
                  ry="24"
                  fill="var(--card)"
                  strokeWidth="2"
                />
                <path d="M 218 66 L 210 84 L 228 72 Z" fill="var(--card)" />
              </g>
              <text
                x="239.5"
                y="57.5"
                textAnchor="middle"
                fill="var(--accent)"
                fontSize="22"
                fontWeight="700"
                className="font-hand"
              >
                {t("cheers")}
              </text>
              <text
                x="238"
                y="56"
                textAnchor="middle"
                fill="var(--doodle-red)"
                fontSize="22"
                fontWeight="700"
                className="font-hand"
              >
                {t("cheers")}
              </text>
              {/* W·D badge on mug */}
              <g filter="url(#doodle-wobble)">
                <circle
                  cx="145"
                  cy="185"
                  r="13"
                  fill="var(--accent)"
                  stroke="var(--border)"
                  strokeWidth="2"
                />
                <text
                  x="145"
                  y="190"
                  textAnchor="middle"
                  fill="var(--border)"
                  fontSize="11"
                  fontWeight="700"
                  className="font-hand"
                >
                  W·D
                </text>
              </g>
              {/* Tape strip, bottom left */}
              <g filter="url(#doodle-wobble)">
                <rect
                  x="8"
                  y="238"
                  width="52"
                  height="14"
                  fill="var(--tape)"
                  opacity="0.9"
                  transform="rotate(-3 8 238)"
                />
                <text
                  x="34"
                  y="248"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="var(--border)"
                  className="font-hand"
                  transform="rotate(-3 8 238)"
                >
                  tue 9/2
                </text>
              </g>
              {/* Margin notes */}
              <text
                x="90"
                y="252"
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="var(--secondary)"
                className="font-hand"
              >
                ~ ipa? stout? ~
              </text>
              <text
                x="222"
                y="252"
                textAnchor="middle"
                fontSize="12"
                fontStyle="italic"
                fill="var(--border)"
                className="font-hand"
              >
                — W·D ✦ —
              </text>
              {/* Star doodle */}
              <path
                d="M282 208 L284 214 L290 214 L285 218 L287 224 L282 220 L277 224 L279 218 L274 214 L280 214 Z"
                fill="var(--primary)"
                stroke="var(--border)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                filter="url(#doodle-wobble)"
              />
              {/* Heart doodle */}
              <g transform="translate(-4 20)" filter="url(#doodle-wobble)">
                <path
                  d="M18 62 Q 12 54 20 52 Q 25 52 27 57 Q 29 52 34 52 Q 42 54 36 62 Q 31 67 27 69 Q 23 67 18 62 Z"
                  fill="var(--accent)"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </g>
              {/* Asterisk sparkle */}
              <g
                stroke="var(--border)"
                strokeWidth="1.5"
                strokeLinecap="round"
                filter="url(#doodle-wobble)"
              >
                <line x1="72" y1="20" x2="72" y2="36" />
                <line x1="64" y1="28" x2="80" y2="28" />
                <line x1="66" y1="22" x2="78" y2="34" />
                <line x1="78" y1="22" x2="66" y2="34" />
              </g>
            </svg>
          </div>
        </div>
      </Container>
    </section>
  );
}

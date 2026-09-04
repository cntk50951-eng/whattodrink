import type { Theme } from "../types";

/**
 * Hand-drawn Doodle — UR1.5 default homepage style.
 * Source: UI style/phase2/07-hand-drawn-doodle.html (Stitch screen 507cd05b…).
 *
 * Notebook margin doodles: cream paper, wobbly ink lines, mustard + teal +
 * soft pink accents. Values are the exact POC hex — valid CSS custom property
 * values, no oklch conversion needed.
 */
export const doodle: Theme = {
  id: "doodle",
  name: "Hand-drawn Doodle",
  description: "筆記本手繪塗鴉，奶油紙 + 墨線 + 芥末黃點綴",
  tokens: {
    "--background": "#f5ecd5",
    "--foreground": "#1a2530",
    "--card": "#f5ecd5",
    "--card-foreground": "#1a2530",
    "--popover": "#f5ecd5",
    "--popover-foreground": "#1a2530",
    "--primary": "#d8a838",
    "--primary-foreground": "#1a2530",
    "--secondary": "#3a8a8a",
    "--secondary-foreground": "#f5ecd5",
    "--muted": "#ede0c0",
    "--muted-foreground": "#4a5568",
    "--accent": "#e8a0a0",
    "--accent-foreground": "#1a2530",
    "--destructive": "#c4302b",
    "--border": "#1a2530",
    "--input": "#1a2530",
    "--ring": "#d8a838",
    "--radius": "0.75rem",
    // Doodle extras (non-shadcn, used by doodle-styled components)
    "--paper-2": "#ede0c0",
    "--mustard-soft": "#e8c878",
    "--teal-soft": "#6ababa",
    "--pink-soft": "#f0c0c0",
    "--doodle-red": "#c4302b",
    "--tape": "#f0e0a8",
  },
};

import type { Theme } from "../types";

/**
 * Flat Illustration — inspired by UI style/01 Flat.jpg
 * 色塊+粗描邊+暖色系，深 navy 背景配奶油色前景
 */
export const flatIllustration: Theme = {
  id: "flat-illustration",
  name: "Flat Illustration",
  description: "色塊+粗描邊，暖色調啤酒主題",
  tokens: {
    "--primary": "oklch(0.72 0.16 65)",
    "--primary-foreground": "oklch(0.15 0.02 250)",
    "--background": "oklch(0.18 0.04 250)",
    "--foreground": "oklch(0.97 0.02 90)",
    "--card": "oklch(0.22 0.05 250)",
    "--card-foreground": "oklch(0.97 0.02 90)",
    "--secondary": "oklch(0.28 0.04 250)",
    "--secondary-foreground": "oklch(0.97 0.02 90)",
    "--muted": "oklch(0.28 0.04 250)",
    "--muted-foreground": "oklch(0.7 0.02 90)",
    "--accent": "oklch(0.85 0.14 80)",
    "--accent-foreground": "oklch(0.18 0.04 250)",
    "--border": "oklch(0.95 0.02 90 / 18%)",
    "--input": "oklch(0.95 0.02 90 / 20%)",
    "--ring": "oklch(0.72 0.16 65)",
    "--radius": "0.625rem",
  },
};

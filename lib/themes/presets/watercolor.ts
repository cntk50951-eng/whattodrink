import type { Theme } from "../types";

/**
 * Watercolor — inspired by UI style/14 Watercolor.jpg
 * 淡雅、留白、適合心情記錄的雅致感
 */
export const watercolor: Theme = {
  id: "watercolor",
  name: "Watercolor",
  description: "淡雅留白，適合心情記錄",
  tokens: {
    "--primary": "oklch(0.7 0.1 70)",
    "--primary-foreground": "oklch(0.2 0.02 70)",
    "--background": "oklch(0.98 0.01 90)",
    "--foreground": "oklch(0.3 0.02 60)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.3 0.02 60)",
    "--secondary": "oklch(0.92 0.04 350)",
    "--secondary-foreground": "oklch(0.3 0.02 350)",
    "--muted": "oklch(0.95 0.02 90)",
    "--muted-foreground": "oklch(0.5 0.02 60)",
    "--accent": "oklch(0.85 0.06 150)",
    "--accent-foreground": "oklch(0.25 0.04 150)",
    "--border": "oklch(0.85 0.02 60)",
    "--input": "oklch(0.85 0.02 60)",
    "--ring": "oklch(0.7 0.1 70)",
    "--radius": "0.875rem",
  },
};

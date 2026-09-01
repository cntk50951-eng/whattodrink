import type { Theme } from "../types";

/**
 * Neo-Brutalism — inspired by UI style/19 Neo-Brutalism.jpg
 * 粗黑邊框 + 高飽和撞色，零圓角，極具攻擊性
 */
export const neoBrutalism: Theme = {
  id: "neo-brutalism",
  name: "Neo-Brutalism",
  description: "粗黑邊框 + 高飽和撞色，反設計風格",
  tokens: {
    "--primary": "oklch(0.88 0.21 110)",
    "--primary-foreground": "oklch(0.15 0 0)",
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0.15 0 0)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.15 0 0)",
    "--secondary": "oklch(0.72 0.25 0)",
    "--secondary-foreground": "oklch(0.15 0 0)",
    "--muted": "oklch(0.95 0.02 110)",
    "--muted-foreground": "oklch(0.3 0 0)",
    "--accent": "oklch(0.78 0.22 290)",
    "--accent-foreground": "oklch(0.15 0 0)",
    "--border": "oklch(0.15 0 0)",
    "--input": "oklch(0.15 0 0)",
    "--ring": "oklch(0.15 0 0)",
    "--radius": "0rem",
  },
};

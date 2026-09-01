import type { Theme } from "../types";

/**
 * Nova — the default shadcn preset. Empty tokens = use globals.css :root.
 * Listed here so the registry has a stable entry; users can always fall back to it.
 */
export const nova: Theme = {
  id: "nova",
  name: "Nova (Default)",
  description: "shadcn Nova preset — neutral grayscale baseline",
  tokens: {},
};

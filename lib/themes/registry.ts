import type { Theme } from "./types";
import { nova } from "./presets/nova";
import { flatIllustration } from "./presets/flat-illustration";
import { neoBrutalism } from "./presets/neo-brutalism";
import { watercolor } from "./presets/watercolor";

/**
 * The theme registry. Order matters — first entry is the default.
 * Add new themes here once the user picks visual directions from `UI style/`.
 */
export const themes: Theme[] = [
  nova,
  flatIllustration,
  neoBrutalism,
  watercolor,
];

export const DEFAULT_THEME_ID = themes[0].id;

export function getTheme(id: string | undefined | null): Theme {
  if (!id) return themes[0];
  return themes.find((t) => t.id === id) ?? themes[0];
}

export const THEME_STORAGE_KEY = "whattodrink:theme";

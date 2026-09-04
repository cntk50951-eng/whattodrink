import type { Theme } from "./types";
import { doodle } from "./presets/doodle";
import { nova } from "./presets/nova";
import { flatIllustration } from "./presets/flat-illustration";
import { neoBrutalism } from "./presets/neo-brutalism";
import { watercolor } from "./presets/watercolor";

/**
 * The theme registry. Order matters — first entry is the default.
 * UR1.5: doodle is the single homepage style; other presets stay registered
 * (infra retained) but have no UI entry point.
 */
export const themes: Theme[] = [
  doodle,
  nova,
  flatIllustration,
  neoBrutalism,
  watercolor,
];

export const DEFAULT_THEME_ID = themes[0].id;

/**
 * UR1.5 single-style lock. When set, ThemeProvider always applies this theme
 * and ignores any id persisted in localStorage (e.g. leftover picks from the
 * UR1.2 switcher era such as dark `flat-illustration`). Set to null to
 * restore persisted multi-theme choice.
 */
export const LOCKED_THEME_ID: string | null = "doodle";

export function getTheme(id: string | undefined | null): Theme {
  if (!id) return themes[0];
  return themes.find((t) => t.id === id) ?? themes[0];
}

export const THEME_STORAGE_KEY = "whattodrink:theme";

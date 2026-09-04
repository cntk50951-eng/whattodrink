"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_ID,
  LOCKED_THEME_ID,
  THEME_STORAGE_KEY,
  getTheme,
  themes,
} from "@/lib/themes/registry";
import type { Theme } from "@/lib/themes/types";

type ThemeContextValue = {
  theme: Theme;
  themeId: string;
  setThemeId: (id: string) => void;
  available: Theme[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applies a theme's tokens as inline CSS variables on <html>, falling back to
 * globals.css :root for any unset token. Persists the choice to localStorage.
 *
 * NOTE: Until the user picks a style we render children against the default theme
 * on the server, then swap to the persisted theme on mount. A tiny flash is
 * possible but acceptable for a prototype.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(
    LOCKED_THEME_ID ?? DEFAULT_THEME_ID,
  );

  // Hydrate from localStorage after mount — skipped while LOCKED_THEME_ID is
  // set (UR1.5 single-style phase: stale stored ids must not override doodle).
  useEffect(() => {
    if (LOCKED_THEME_ID) return;
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && themes.some((t) => t.id === stored)) {
        setThemeIdState(stored);
      }
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, []);

  // Apply tokens to <html> whenever themeId changes.
  useEffect(() => {
    const theme = getTheme(themeId);
    const root = document.documentElement;
    // Clear any previously applied theme tokens (anything starting with --).
    // We don't blindly clear every var because globals.css sets the defaults;
    // only the keys this theme overrides get re-applied below.
    for (const [key, value] of Object.entries(theme.tokens)) {
      root.style.setProperty(key, value);
    }
  }, [themeId]);

  const setThemeId = useCallback((id: string) => {
    if (LOCKED_THEME_ID) return;
    if (!themes.some((t) => t.id === id)) return;
    setThemeIdState(id);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const theme = getTheme(themeId);

  return (
    <ThemeContext.Provider
      value={{ theme, themeId, setThemeId, available: themes }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}

/**
 * Theme tokens are a partial record of CSS variables defined in `app/globals.css`.
 * Each theme overrides only the variables it wants to change — anything unset
 * falls back to the `:root` defaults in `globals.css`.
 *
 * To add a new theme:
 *   1. Create a new file under `lib/themes/presets/`
 *   2. Export a `Theme` object with tokens for the variables you want to override
 *   3. Register it in `lib/themes/registry.ts`
 */
export type Theme = {
  id: string;
  name: string;
  description?: string;
  /** Map of CSS variable name → value (e.g. `--primary: oklch(...)`) */
  tokens: Record<string, string>;
};

import { routing, type AppLocale } from "./routing";

// Only marketing intro routes ignore negotiation. Explicit locale prefixes still win.
export const introRouting = { ...routing, localeDetection: false } as const;

export function isIntroRoute(pathname: string): boolean {
  const segments = pathname.replace(/\/$/, "").split("/").slice(1);
  if (routing.locales.includes(segments[0] as AppLocale)) segments.shift();
  return (segments[0] === "intro" || segments[0] === "intro-next")
    && (segments.length === 1 || segments.length === 2 && segments[1] === "artwork");
}

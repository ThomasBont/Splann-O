import type { ThemeToken } from "./eventThemes";

/** Neutral header container classes. Surfaces stay neutral; theme applied via strip. */
export function headerClass(_theme: ThemeToken): string {
  return "rounded-xl shadow-sm border border-border bg-card overflow-hidden";
}

/** Neutral card container classes. Surfaces stay neutral per design. */
export function cardClass(_theme: ThemeToken): string {
  return "rounded-xl border border-border bg-card";
}

/** Neutral chip/badge base classes. */
export function chipClass(_theme: ThemeToken): string {
  return "rounded-md px-2.5 py-1 text-xs font-medium border border-border";
}

/** Neutral button classes (primary-style). */
export function buttonClass(_theme: ThemeToken): string {
  return "rounded-lg font-semibold transition-colors";
}

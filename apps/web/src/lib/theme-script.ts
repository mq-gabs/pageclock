/**
 * Light / dark theme, chosen per device in Settings and kept in localStorage.
 * "system" follows the OS. The choice is a `data-theme` attribute on `<html>` (none for
 * "system"); `globals.css` turns it into `color-scheme`, which picks each token's value.
 */
export const themePreferences = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof themePreferences)[number];

export const themeStorageKey = 'pageclock.theme';

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Runs in `<head>` before the first paint, so a saved theme never flashes the other one. */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  themeStorageKey,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

import {
  BUILTIN_THEMES,
  DARK_THEME,
  DEFAULT_THEME_NAME,
} from "./themes.js";
import type { ThemeTokens } from "./tokens.js";

export type ThemeConfig =
  | string
  | { name?: string; tokens?: Partial<ThemeTokens> }
  | null
  | undefined;

export interface ThemeLoadResult {
  theme: ThemeTokens;
  warning: string | null;
}

/**
 * Pure resolver: takes a user-supplied theme value from
 * ~/.miot-chat/config.json["theme"] and returns the resolved
 * ThemeTokens + optional warning string the UI should surface as a
 * system transcript item.
 *
 * Never throws — invalid input degrades to the default theme + a
 * descriptive warning.
 */
export function loadUserTheme(config: ThemeConfig): ThemeLoadResult {
  if (config === undefined || config === null) {
    return { theme: DARK_THEME, warning: null };
  }
  if (typeof config === "string") {
    return resolveByName(config);
  }
  if (typeof config !== "object") {
    return {
      theme: DARK_THEME,
      warning: `theme config must be a string or object, got ${typeof config}`,
    };
  }
  const name = config.name ?? DEFAULT_THEME_NAME;
  const baseResult = resolveByName(name);
  const overrides = config.tokens ?? {};
  return {
    theme: { ...baseResult.theme, ...overrides },
    warning: baseResult.warning,
  };
}

function resolveByName(name: string): ThemeLoadResult {
  const found = BUILTIN_THEMES[name];
  if (found) return { theme: found, warning: null };
  return {
    theme: DARK_THEME,
    warning: `unknown theme: ${name}, falling back to ${DEFAULT_THEME_NAME}`,
  };
}

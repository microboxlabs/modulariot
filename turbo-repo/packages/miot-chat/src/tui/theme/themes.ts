import type { ThemeTokens } from "./tokens.js";

export const DARK_THEME: ThemeTokens = {
  accent: "cyan",
  assistant: "white",
  user: "cyan",
  dim: "gray",
  warn: "yellow",
  err: "red",
  ok: "green",
  border: "gray",
  prompt: "cyan",
  spinner: "cyan",
};

export const LIGHT_THEME: ThemeTokens = {
  accent: "blue",
  assistant: "black",
  user: "blue",
  dim: "gray",
  warn: "yellow",
  err: "red",
  ok: "green",
  border: "gray",
  prompt: "blue",
  spinner: "blue",
};

export const HIGH_CONTRAST_THEME: ThemeTokens = {
  accent: "white",
  assistant: "white",
  user: "white",
  dim: "white",
  warn: "yellow",
  err: "red",
  ok: "green",
  border: "white",
  prompt: "white",
  spinner: "white",
};

export const BUILTIN_THEMES: Record<string, ThemeTokens> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
  "high-contrast": HIGH_CONTRAST_THEME,
};

export const DEFAULT_THEME_NAME = "dark";

export function builtinThemeNames(): string[] {
  return Object.keys(BUILTIN_THEMES).sort();
}

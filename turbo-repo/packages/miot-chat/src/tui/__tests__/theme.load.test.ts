import { describe, expect, it } from "vitest";
import {
  BUILTIN_THEMES,
  DARK_THEME,
  DEFAULT_THEME_NAME,
  HIGH_CONTRAST_THEME,
  LIGHT_THEME,
  builtinThemeNames,
} from "../theme/themes.js";
import { loadUserTheme } from "../theme/loadUserTheme.js";

describe("themes registry", () => {
  it("exposes the three builtins sorted by name", () => {
    expect(builtinThemeNames()).toEqual(["dark", "high-contrast", "light"]);
  });

  it("DEFAULT_THEME_NAME points to dark", () => {
    expect(DEFAULT_THEME_NAME).toBe("dark");
    expect(BUILTIN_THEMES.dark).toBe(DARK_THEME);
  });
});

describe("loadUserTheme — defaults", () => {
  it("returns DARK_THEME + no warning when config is undefined", () => {
    const r = loadUserTheme(undefined);
    expect(r.theme).toEqual(DARK_THEME);
    expect(r.warning).toBeNull();
  });

  it("returns DARK_THEME + no warning when config is null", () => {
    const r = loadUserTheme(null);
    expect(r.theme).toEqual(DARK_THEME);
    expect(r.warning).toBeNull();
  });
});

describe("loadUserTheme — string config", () => {
  it("resolves a known builtin name", () => {
    expect(loadUserTheme("light").theme).toEqual(LIGHT_THEME);
    expect(loadUserTheme("high-contrast").theme).toEqual(HIGH_CONTRAST_THEME);
    expect(loadUserTheme("light").warning).toBeNull();
  });

  it("falls back to dark and warns on an unknown name", () => {
    const r = loadUserTheme("solarized-toast");
    expect(r.theme).toEqual(DARK_THEME);
    expect(r.warning).toContain("unknown theme: solarized-toast");
    expect(r.warning).toContain("falling back to dark");
  });
});

describe("loadUserTheme — object config", () => {
  it("uses config.name as the base", () => {
    const r = loadUserTheme({ name: "light" });
    expect(r.theme).toEqual(LIGHT_THEME);
    expect(r.warning).toBeNull();
  });

  it("merges config.tokens over the base theme", () => {
    const r = loadUserTheme({
      name: "light",
      tokens: { accent: "#ff0080", prompt: "magenta" },
    });
    expect(r.theme).toMatchObject({
      ...LIGHT_THEME,
      accent: "#ff0080",
      prompt: "magenta",
    });
  });

  it("uses dark as the base when config.name is omitted", () => {
    const r = loadUserTheme({ tokens: { accent: "magenta" } });
    expect(r.theme.accent).toBe("magenta");
    expect(r.theme.assistant).toBe(DARK_THEME.assistant);
  });

  it("warns on unknown name but still applies the overrides", () => {
    const r = loadUserTheme({
      name: "nope",
      tokens: { accent: "magenta" },
    });
    expect(r.warning).toContain("unknown theme: nope");
    expect(r.theme.accent).toBe("magenta");
  });

  it("rejects non-string non-object config with a warning", () => {
    // @ts-expect-error: deliberately passing an invalid runtime value
    const r = loadUserTheme(123);
    expect(r.theme).toEqual(DARK_THEME);
    expect(r.warning).toContain("must be a string or object");
  });
});

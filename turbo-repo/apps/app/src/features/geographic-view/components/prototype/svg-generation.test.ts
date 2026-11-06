import { describe, expect, it } from "vitest";
import { createSVGIcon, disconnected_pin, svgCacheKey } from "./svg-generation";

const BLUE = "#3B82F6";
const GRAY = disconnected_pin.main_color;
/** The disconnected face's eye. */
const DISCONNECTED_FACE = '<ellipse cx="15" cy="34.4185"';
/** The normal (Happy) face's eye. */
const NORMAL_FACE = '<ellipse cx="11.1496"';

function svg(url: string): string {
  return atob(url.replace("data:image/svg+xml;base64,", ""));
}

/** The pin's inner fill color. */
function innerColor(url: string): string | undefined {
  return /<path d="M12\.5504[^"]*" fill="([^"]+)"/.exec(svg(url))?.[1];
}

describe("createSVGIcon", () => {
  it("draws the normal blue pin when the engine state is unknown", () => {
    const url = createSVGIcon(1, false);
    expect(innerColor(url)).toBe(BLUE);
    expect(svg(url)).toContain(NORMAL_FACE);
    expect(createSVGIcon(1, false, false)).toBe(url);
  });

  it("draws an engine-off pin gray with its normal face", () => {
    const url = createSVGIcon(1, false, true);
    expect(innerColor(url)).toBe(GRAY);
    expect(svg(url)).toContain(NORMAL_FACE);
    expect(svg(url)).not.toContain(DISCONNECTED_FACE);
  });

  it("draws an offline pin gray with the disconnected face", () => {
    const url = createSVGIcon(1, true);
    expect(innerColor(url)).toBe(GRAY);
    expect(svg(url)).toContain(DISCONNECTED_FACE);
    expect(svg(url)).not.toContain(NORMAL_FACE);
  });

  it("draws the offline pin when the signal is lost and the engine is off", () => {
    expect(createSVGIcon(1, true, true)).toBe(createSVGIcon(1, true));
    expect(createSVGIcon(1, true, true)).not.toBe(
      createSVGIcon(1, false, true)
    );
  });
});

describe("svgCacheKey", () => {
  it("includes the engine-off flag", () => {
    expect(svgCacheKey(1, false, true)).not.toBe(svgCacheKey(1, false, false));
    expect(svgCacheKey(1, false, true)).toBe("Happy-false-true");
    expect(svgCacheKey(1, false)).toBe("Happy-false-false");
  });

  it("drops the engine-off flag when the signal is lost", () => {
    expect(svgCacheKey(1, true, true)).toBe(svgCacheKey(1, true, false));
  });
});

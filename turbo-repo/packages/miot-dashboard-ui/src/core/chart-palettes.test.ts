import { describe, expect, it } from "vitest";
import {
  CHART_COLOR_PALETTES,
  getChartColors,
  type ChartColorPalette,
} from "./chart-palettes";

describe("chart palettes", () => {
  it("preserves named palette colors and defaults empty or unknown palettes", () => {
    expect(getChartColors("cool")).toEqual([
      "#3b82f6",
      "#06b6d4",
      "#8b5cf6",
      "#6366f1",
      "#14b8a6",
      "#0ea5e9",
    ]);
    expect(getChartColors("custom")).toEqual(CHART_COLOR_PALETTES.default);
    for (const key of ["missing", "constructor", "toString", "__proto__"]) {
      expect(getChartColors(key as ChartColorPalette)).toEqual(
        CHART_COLOR_PALETTES.default,
      );
    }
  });

  it("isolates returned colors from other dashboards and host configuration", () => {
    const first = getChartColors("cool");
    first[0] = "#ffffff";
    expect(getChartColors("cool")[0]).toBe("#3b82f6");
    const custom = ["#123456"];
    const resolved = getChartColors("custom", custom);
    resolved.push("#ffffff");
    expect(custom).toEqual(["#123456"]);
    expect(getChartColors("custom", custom)).toEqual(["#123456"]);
  });

  it("freezes the public catalog and its arrays", () => {
    expect(Object.isFrozen(CHART_COLOR_PALETTES)).toBe(true);
    for (const colors of Object.values(CHART_COLOR_PALETTES)) {
      expect(Object.isFrozen(colors)).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import { getColor, stoppedMarkProps } from "./pulse-base";

describe("stoppedMarkProps", () => {
  it("draws a stopped vehicle hollow, ringed in its level color, never red", () => {
    const props = stoppedMarkProps((d: { level: number }) => d.level);
    expect(props.getFillColor()).toEqual([255, 255, 255, 255]);
    expect(props.getLineColor({ level: 0 })).toEqual(getColor(0));
    expect(props.getLineColor({ level: 3 })).toEqual(getColor(3));
    expect(props.stroked).toBe(true);
  });
});

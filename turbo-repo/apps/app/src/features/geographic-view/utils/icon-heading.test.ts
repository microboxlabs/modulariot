import { describe, expect, it } from "vitest";
import { WebMercatorViewport } from "@deck.gl/core";
import { headingToIconAngle, iconTipOffset } from "./icon-heading";

const LNG = -76.93;
const LAT = -12.25;

function view(bearing: number, pitch: number) {
  return new WebMercatorViewport({
    width: 800,
    height: 600,
    longitude: LNG,
    latitude: LAT,
    zoom: 15,
    bearing,
    pitch,
  });
}

/** Screen direction (y down) the icon's tip points to. */
function tip(angle: number): [number, number] {
  return iconTipOffset(angle, 1);
}

describe("headingToIconAngle", () => {
  it("turns the icon clockwise for a clockwise compass heading on a north-up map", () => {
    const [x, y] = tip(headingToIconAngle(view(0, 0), LNG, LAT, 90));
    expect(x).toBeCloseTo(1, 3);
    expect(y).toBeCloseTo(0, 3);
  });

  it("points a north-west vehicle up and to the left", () => {
    const [x, y] = tip(headingToIconAngle(view(0, 0), LNG, LAT, 302));
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
  });

  it("follows the map's bearing", () => {
    // Bearing 45 puts north-east at the top of the screen.
    const [x, y] = tip(headingToIconAngle(view(45, 0), LNG, LAT, 45));
    expect(x).toBeCloseTo(0, 3);
    expect(y).toBeCloseTo(-1, 3);
  });

  it("follows the map's pitch", () => {
    const flat = tip(headingToIconAngle(view(0, 0), LNG, LAT, 45));
    const tilted = tip(headingToIconAngle(view(0, 60), LNG, LAT, 45));
    // A tilted map shortens north-south distances, so the tip leans toward east.
    expect(Math.abs(tilted[0])).toBeGreaterThan(Math.abs(flat[0]));
  });

  it("falls back to a north-up angle without a viewport", () => {
    expect(headingToIconAngle(undefined, LNG, LAT, 90)).toBe(-90);
  });
});

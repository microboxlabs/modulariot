import { describe, expect, it } from "vitest";
import { WebMercatorViewport } from "@deck.gl/core";
import { headingToIconAngle, iconTipOffset, viewportKey } from "./icon-heading";

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

  it.each([0, 90, 180, 270])(
    "projects heading %i with bearing and pitch together",
    (heading) => {
      const delta = ((heading - 35) * Math.PI) / 180;
      const expected = [-Math.sin(delta), Math.cos(delta) * 0.5];
      const length = Math.hypot(...expected);
      const [x, y] = tip(headingToIconAngle(view(35, 60), LNG, LAT, heading));
      expect(x).toBeCloseTo(-expected[0] / length, 3);
      expect(y).toBeCloseTo(-expected[1] / length, 3);
    }
  );

  it.each([
    [NaN, LAT],
    [LNG, Infinity],
    [-Infinity, LAT],
  ])("falls back for non-finite coordinates %j", (longitude, latitude) => {
    expect(headingToIconAngle(view(45, 60), longitude, latitude, 90)).toBe(-90);
  });

  it.each([
    [Infinity, 0],
    [NaN, NaN],
    [0, 0],
  ])("falls back for unusable projected directions %j", (x, y) => {
    const viewport = { project: () => [x, y] };
    expect(headingToIconAngle(viewport, LNG, LAT, 90)).toBe(-90);
  });

  it("changes the angle trigger when the view moves", () => {
    expect(viewportKey(undefined)).toBe("");
    expect(viewportKey(view(0, 0))).not.toBe(viewportKey(view(90, 0)));
    expect(viewportKey(view(0, 0))).not.toBe(viewportKey(view(0, 60)));
    const viewport = view(35, 60);
    const resized = new WebMercatorViewport({ ...viewport, height: 400 });
    expect(viewportKey(viewport)).not.toBe(viewportKey(resized));
    const before = headingToIconAngle(viewport, LNG + 0.02, LAT + 0.01, 45);
    const after = headingToIconAngle(resized, LNG + 0.02, LAT + 0.01, 45);
    expect(Math.abs(after - before)).toBeGreaterThan(0.1);
  });
});

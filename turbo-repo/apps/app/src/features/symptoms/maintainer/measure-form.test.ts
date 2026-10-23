import { describe, expect, it } from "vitest";
import type { SourceField } from "./maintainer-api";
import { compileMeasure, measureFromForm, parseMeasure } from "./measure-form";

const field = (path: string, label: string, type = "number", unit = "km/h") =>
  ({
    path,
    label,
    type,
    unit,
    origin: null,
    engineSupported: true,
  }) as SourceField;

const FIELDS = [
  field("signal.frame.gps.speed", "Velocidad"),
  field("signal.road.maxspeed_osm", "Límite de la vía"),
  field("signal.trip.active", "En viaje", "bool", ""),
];

describe("parseMeasure", () => {
  it("reads a field, a field minus a field and a field minus a number", () => {
    expect(parseMeasure("signal.frame.gps.speed", FIELDS)).toEqual({
      field: "signal.frame.gps.speed",
      minus: null,
    });
    expect(
      parseMeasure("signal.frame.gps.speed - signal.road.maxspeed_osm", FIELDS)
    ).toEqual({
      field: "signal.frame.gps.speed",
      minus: { kind: "field", path: "signal.road.maxspeed_osm" },
    });
    expect(parseMeasure("signal.frame.gps.speed-90", FIELDS)).toEqual({
      field: "signal.frame.gps.speed",
      minus: { kind: "number", value: 90 },
    });
  });

  it("leaves other expressions to the { } editor", () => {
    expect(parseMeasure("signal.frame.gps.speed * 2", FIELDS)).toBeNull();
    expect(parseMeasure("signal.trip.active", FIELDS)).toBeNull();
    expect(parseMeasure("signal.unknown", FIELDS)).toBeNull();
    expect(parseMeasure("signal.frame.gps.speed - x", FIELDS)).toBeNull();
  });

  it("writes back what it reads", () => {
    const text = "signal.frame.gps.speed - signal.road.maxspeed_osm";
    const form = parseMeasure(text, FIELDS);
    expect(form && compileMeasure(form)).toBe(text);
  });
});

describe("measureFromForm", () => {
  it("names the measure after its fields while the owner has not named it", () => {
    const first = measureFromForm(
      { field: "signal.frame.gps.speed", minus: null },
      null,
      FIELDS
    );
    expect(first).toEqual({
      expression: "signal.frame.gps.speed",
      label: "Velocidad",
      unit: "km/h",
    });
    expect(
      measureFromForm(
        {
          field: "signal.frame.gps.speed",
          minus: { kind: "field", path: "signal.road.maxspeed_osm" },
        },
        first,
        FIELDS
      ).label
    ).toBe("Velocidad − Límite de la vía");
  });

  it("keeps a name the owner wrote", () => {
    const named = {
      expression: "signal.frame.gps.speed - signal.road.maxspeed_osm",
      label: "Exceso sobre el límite",
      unit: "km/h",
    };
    expect(
      measureFromForm(
        {
          field: "signal.frame.gps.speed",
          minus: { kind: "number", value: 90 },
        },
        named,
        FIELDS
      )
    ).toEqual({
      expression: "signal.frame.gps.speed - 90",
      label: "Exceso sobre el límite",
      unit: "km/h",
    });
  });
});

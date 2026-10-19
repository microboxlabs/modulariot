import { describe, expect, it } from "vitest";
import type { SymptomSpec } from "./maintainer-api";
import { overviewText } from "./overview-text";

const response = (operator: boolean, slaMinutes: number | null) => ({
  operator,
  slaMinutes,
  steps: [],
  notices: [],
  evidence: [],
  ignorable: false,
});

const SPEC = {
  source: "gps_signal",
  activation: "signal.trip.active\n&& signal.road.maxspeed_osm > 0",
  measure: {
    expression: "signal.gps.speed_kmh - signal.road.maxspeed_osm",
    label: "Exceso",
    unit: "km/h",
  },
  levels: [
    {
      icu: 4,
      applies: true,
      when: "medida >= 21",
      response: response(true, 4),
    },
    { icu: 2, applies: false, when: "", response: null },
    {
      icu: 1,
      applies: true,
      when: "medida > 0",
      response: response(false, null),
    },
    {
      icu: 3,
      applies: true,
      when: "medida >= 11",
      response: response(true, null),
    },
  ],
  lifecycle: {
    open: "caso.condicion_s >= 0",
    close: "caso.normal_s >= 120",
    levelDown: false,
  },
} as unknown as SymptomSpec;

describe("overviewText", () => {
  it("lists activation, measure, the levels that apply in order with who responds, open and close", () => {
    expect(overviewText(SPEC)).toBe(
      [
        "activa: signal.trip.active\n&& signal.road.maxspeed_osm > 0",
        "medida: signal.gps.speed_kmh - signal.road.maxspeed_osm (km/h)",
        "nivel 1: medida > 0 · sin operador",
        "nivel 3: medida >= 11 · operador",
        "nivel 4: medida >= 21 · operador 4 min",
        "abre: caso.condicion_s >= 0",
        "cierra: caso.normal_s >= 120",
      ].join("\n")
    );
  });

  it("is empty without an activation or when too long to send", () => {
    expect(overviewText({ ...SPEC, activation: " " })).toBe("");
    expect(overviewText({ ...SPEC, activation: "a".repeat(4001) })).toBe("");
  });

  it("leaves out the parts the spec does not have", () => {
    expect(
      overviewText({
        activation: "x",
        measure: null,
        levels: null,
        lifecycle: null,
      } as unknown as SymptomSpec)
    ).toBe("activa: x");
  });
});

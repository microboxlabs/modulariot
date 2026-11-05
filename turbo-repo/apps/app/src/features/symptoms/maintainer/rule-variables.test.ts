import { describe, expect, it } from "vitest";
import { celField } from "./symptom-rule-sections";

const d = { originCalculated: "calculado" };

describe("celField", () => {
  it("keeps the server's meaning, type, unit and origin", () => {
    expect(
      celField(
        {
          path: "signal.trip.age_min",
          label: "Tiempo en viaje",
          type: "number",
          unit: "min",
          origin: null,
          engineSupported: true,
        },
        d
      )
    ).toEqual({
      path: "signal.trip.age_min",
      type: "number",
      unit: "min",
      detail: undefined,
      description: "Tiempo en viaje",
    });
  });

  it("drops a label that only repeats the field's name", () => {
    expect(
      celField(
        {
          path: "signal.frame.gps.course",
          label: "course",
          type: "number",
          unit: null,
          origin: null,
          engineSupported: true,
        },
        d
      ).description
    ).toBeUndefined();
  });
});

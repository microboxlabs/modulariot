import { describe, expect, it } from "vitest";
import { celField } from "./symptom-rule-sections";
import { celFieldInfos, visiblePaths } from "./sample-tree";

const d = { originCalculated: "calculado" };

describe("celField", () => {
  it("preserves the schema explanation alongside the title for trees and editors", () => {
    const field = celField(
      {
        path: "signal.geo.authorized_zone",
        label: "En zona autorizada",
        description: "Dentro de al menos una zona autorizada",
        type: "bool",
        unit: null,
        origin: null,
        engineSupported: true,
      },
      d
    );
    expect(field.description).toBe(
      "En zona autorizada — Dentro de al menos una zona autorizada"
    );
    expect(
      visiblePaths(
        { signal: { geo: { authorized_zone: true } } },
        "al menos",
        celFieldInfos([field])
      )
    ).toEqual(new Set(["signal.geo.authorized_zone", "signal.geo", "signal"]));
  });
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

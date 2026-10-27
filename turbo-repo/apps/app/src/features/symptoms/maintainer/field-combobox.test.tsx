import { describe, expect, it } from "vitest";
import { fieldSections, folded } from "./field-combobox";
import type { SourceField } from "./maintainer-api";

const field = (
  path: string,
  label: string,
  origin: SourceField["origin"]
): SourceField => ({
  path,
  label,
  type: "bool",
  unit: null,
  origin,
  engineSupported: true,
});

const FIELDS = [
  field("signal.trip.active", "En viaje", "TRIP"),
  field("signal.vehicle.weight_category", "Categoría de peso", "VEHICLE"),
  field(
    "signal.frame.sensors.panic_button",
    "Botón de pánico presionado",
    "DEVICE"
  ),
  field("signal.frame.sensors.engine_status", "Motor encendido", "DEVICE"),
];

const d = {
  originTrip: "Viaje",
  originVehicle: "Vehículo",
  originDevice: "Dispositivo",
};

describe("fieldSections", () => {
  it("groups every field by origin, in source order", () => {
    expect(
      fieldSections(FIELDS, "", d).map((s) => s.fields.map((f) => f.path))
    ).toEqual([
      ["signal.trip.active"],
      ["signal.vehicle.weight_category"],
      [
        "signal.frame.sensors.panic_button",
        "signal.frame.sensors.engine_status",
      ],
    ]);
  });

  it("finds by label without accents and by path, every word", () => {
    const paths = (q: string) =>
      fieldSections(FIELDS, q, d).flatMap((s) => s.fields.map((f) => f.path));
    expect(paths("panico")).toEqual(["signal.frame.sensors.panic_button"]);
    expect(paths("sensors motor")).toEqual([
      "signal.frame.sensors.engine_status",
    ]);
    expect(paths("CATEGORIA")).toEqual(["signal.vehicle.weight_category"]);
    expect(paths("nada")).toEqual([]);
  });

  it("folds case and accents", () => {
    expect(folded("Vehículo ÁÉÍ")).toBe("vehiculo aei");
  });
});

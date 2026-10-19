import { describe, expect, it } from "vitest";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { fillScript, stepAt } from "./escalation-ladder-card";

const treatment = {
  trip_info: {
    driver: "Ana Pérez",
    asset_id: "ABCD12",
    origin: "Planta",
    destination: "Puerto",
  },
} as unknown as TreatmentsGeneralResponseItem;

describe("fillScript", () => {
  it("fills the case's values and leaves unknown variables", () => {
    expect(
      fillScript(
        "Hola {{conductor}}, camión {{ patente }} en {{ruta}} a {{velocidad}}",
        treatment
      )
    ).toBe("Hola Ana Pérez, camión ABCD12 en Planta → Puerto a {{velocidad}}");
  });
});

describe("stepAt", () => {
  const steps = [
    { role: "Conductor", channel: "call", budgetMinutes: 1, script: null },
    { role: "Jefe", channel: "call", budgetMinutes: 2, script: null },
  ];

  it("follows the cumulative budget and stays on the last step", () => {
    expect(stepAt(steps, 0)).toBe(0);
    expect(stepAt(steps, 59)).toBe(0);
    expect(stepAt(steps, 60)).toBe(1);
    expect(stepAt(steps, 999)).toBe(1);
  });
});

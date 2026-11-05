import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import PulseTooltip, { symptomTitle } from "./pulse-tooltip";

const dict = {
  symptoms: { SPEED: "Exceso de velocidad", pulses_selected: "Pulsos" },
  geographic_view: {
    signal_lag: "Retraso de señal",
    median_report_interval: "Frecuencia de reportabilidad",
    last_reported_engine_status: "Estado del motor reportado",
    on: "Encendido",
    off: "Apagado",
  },
} as unknown as I18nRecord;

describe("symptomTitle", () => {
  it("translates a legacy symptom key", () => {
    expect(symptomTitle("Speed", dict)).toBe("Exceso de velocidad");
  });

  it("falls back to the name of an engine symptom", () => {
    expect(symptomTitle("Pérdida de señal", dict)).toBe("Pérdida de señal");
    expect(symptomTitle("Botón de pánico", {} as I18nRecord)).toBe(
      "Botón de pánico"
    );
  });
});

describe("PulseTooltip with an engine case's description", () => {
  it("shows the title and the legacy indicators unchanged", () => {
    const { container } = render(
      <PulseTooltip
        dict={dict}
        object={{
          elements: [0],
          appCount: 0,
          gpsCount: 0,
          description: {
            symptom_name: "Pérdida de señal",
            signal_lag: "04:06:31",
            median_report_interval: "00:00:36",
            last_reported_engine_status: false,
          },
        }}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Pérdida de señal");
    expect(text).toContain("Retraso de señal: 04:06:31");
    expect(text).toContain("Frecuencia de reportabilidad: 00:00:36");
    expect(text).toContain("Apagado");
  });
});

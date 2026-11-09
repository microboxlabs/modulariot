import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import PulseTooltip, { symptomTitle } from "./pulse-tooltip";

const dict = {
  symptoms: { SPEED: "Exceso de velocidad", pulses_selected: "Pulsos" },
  geographic_view: {
    speed: "Velocidad",
    speed_limit: "Exceso de límite de velocidad",
    applied_speed_limit: "Límite de velocidad",
    over_limit: " por encima del límite",
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

describe("PulseTooltip on the newest frame", () => {
  const frame = {
    asset_id: "V1",
    icu_code: 0,
    rotation: 0,
    latitude: 0,
    longitude: 0,
    speed: 0,
    timestamp: "2026-01-01T00:00:00Z",
  };

  it("shows the engine-off label", () => {
    const { container } = render(
      <PulseTooltip
        dict={dict}
        object={{ properties: { ...frame, engine_label: "Motor apagado" } }}
      />
    );
    expect(container.querySelector("[data-engine-off]")?.textContent).toBe(
      "Motor apagado"
    );
  });

  it("shows only the lost-signal label when both apply", () => {
    const { container } = render(
      <PulseTooltip
        dict={dict}
        object={{
          properties: {
            ...frame,
            signal_label: "Sin señal · hace 12 min",
            engine_label: "Motor apagado",
          },
        }}
      />
    );
    expect(container.querySelector("[data-engine-off]")).toBeNull();
    expect(container.textContent).toContain("Sin señal · hace 12 min");
  });
});

describe("PulseTooltip speed lines", () => {
  it("keeps the legacy label for a GPS database case", () => {
    const { container } = render(
      <PulseTooltip
        dict={dict}
        object={{ elements: [0], description: { speed: 68, speed_limit: 50 } }}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain(
      "Velocidad: 68 km/h - 18km/h  por encima del límite"
    );
    expect(text).toContain("Exceso de límite de velocidad: 50 km/h");
  });

  it("labels an engine case's limit and names its zone", () => {
    const { container } = render(
      <PulseTooltip
        dict={dict}
        object={{
          elements: [0],
          description: {
            speed: 84,
            speed_limit: 50,
            speed_limit_source: "custom",
            speed_limit_zone: "Tramo norte",
          },
        }}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("84 km/h - 34km/h");
    expect(container.querySelector("[data-speed-limit]")?.textContent).toBe(
      "Límite de velocidad: 50 km/h · Tramo norte"
    );
  });

  it("shows a frame's own limit and excess", () => {
    const { container } = render(
      <PulseTooltip
        dict={dict}
        object={{
          properties: {
            asset_id: "V1",
            icu_code: 0,
            rotation: 0,
            latitude: 0,
            longitude: 0,
            speed: 84,
            timestamp: "2026-01-01T00:00:00Z",
            speed_limit: 60,
          },
        }}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Velocidad: 84 km/h - 24km/h");
    expect(container.querySelector("[data-speed-limit]")?.textContent).toBe(
      "Límite de velocidad: 60 km/h"
    );
  });

  it("shows no limit for a frame without one", () => {
    const { container } = render(
      <PulseTooltip
        dict={dict}
        object={{
          properties: {
            asset_id: "V1",
            icu_code: 0,
            rotation: 0,
            latitude: 0,
            longitude: 0,
            speed: 84,
            timestamp: "2026-01-01T00:00:00Z",
          },
        }}
      />
    );
    expect(container.querySelector("[data-speed-limit]")).toBeNull();
    expect(container.textContent).not.toContain("por encima");
  });
});

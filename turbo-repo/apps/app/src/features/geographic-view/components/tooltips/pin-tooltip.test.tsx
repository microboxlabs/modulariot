import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { MapPositionProperties } from "@/features/geographic-view/types/map";
import PinTooltip from "./pin-tooltip";

vi.mock("./vehicle-description", () => ({ default: () => null }));
vi.mock("@/features/symptoms/components/condition-icon", () => ({
  default: () => null,
}));

const dict = {
  symptoms: { license_plate: "Patente", stable: "Estable" },
  geographic_view: {
    signal_status: "Estado de señal",
    signal_offline: "Sin señal",
    signal_offline_minutes: "Sin señal · hace {n} min",
    signal_offline_hours: "Sin señal · hace {n} h",
    date_and_time: "Fecha y hora",
    speed: "Velocidad",
  },
} as unknown as I18nRecord;

function pin(signal: unknown) {
  return {
    properties: {
      asset_id: "AB12",
      symptoms_condition: 0,
      speed: 0,
      signal,
    },
  } as unknown as MapPositionProperties;
}

describe("PinTooltip signal", () => {
  it("says how long ago an offline vehicle stopped reporting", () => {
    const since = new Date(Date.now() - 125 * 60_000).toISOString();
    render(
      <PinTooltip
        object={pin({ state: "offline", offline_since: since })}
        dict={dict}
      />
    );
    expect(document.querySelector("[data-signal-offline]")).toHaveTextContent(
      "Sin señal · hace 2 h"
    );
  });

  it("says nothing while online or unknown", () => {
    for (const signal of [
      { state: "online" },
      { state: "unknown" },
      undefined,
    ]) {
      const { unmount } = render(
        <PinTooltip object={pin(signal)} dict={dict} />
      );
      expect(document.querySelector("[data-signal-offline]")).toBeNull();
      unmount();
    }
  });
});

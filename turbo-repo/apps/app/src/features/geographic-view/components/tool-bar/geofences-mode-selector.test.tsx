import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import GeofencesModeSelector from "./geofences-mode-selector";

const dict = {
  symptoms: {
    geofences: "Geocercas",
    geofencesMode: {
      all: "Todas las geocercas",
      trip: "Solo geocercas del viaje",
      none: "Sin geocercas",
    },
  },
} as unknown as I18nRecord;

describe("GeofencesModeSelector", () => {
  it("marks the current mode and picks another", () => {
    const setMode = vi.fn();
    render(
      <GeofencesModeSelector mode="trip" setMode={setMode} dictionary={dict} />
    );
    expect(
      screen.getByRole("radio", { name: "Solo geocercas del viaje" })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("radio", { name: "Todas las geocercas" })
    ).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("radio", { name: "Sin geocercas" }));
    expect(setMode).toHaveBeenCalledWith("none");
  });
});

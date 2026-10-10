import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import TreatmentsTimelineBox from "./treatments-timeline-box";

vi.mock("./prototype/prototype-api-guard", () => ({
  isMockDataEnabled: () => false,
}));

const dict = {
  symptoms: { response: "Respuesta", message: "Mensaje" },
} as unknown as I18nRecord;

describe("TreatmentsTimelineBox", () => {
  it("shows a call treatment's message and response without mock call data", () => {
    render(
      <TreatmentsTimelineBox
        dict={dict}
        seed="42"
        treatments={[
          {
            treatment_type: "llamar al conductor",
            description: {
              message: "Se informó la condición",
              driver_response: "No contesta · se envía correo",
            },
          },
        ]}
      />
    );

    expect(screen.getByText("Se informó la condición")).toBeInTheDocument();
    expect(
      screen.getByText("Respuesta: No contesta · se envía correo")
    ).toBeInTheDocument();
  });
});

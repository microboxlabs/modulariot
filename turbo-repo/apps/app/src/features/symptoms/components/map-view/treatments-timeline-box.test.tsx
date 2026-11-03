import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import TreatmentsTimelineBox, { holdLine } from "./treatments-timeline-box";

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

describe("holdLine", () => {
  const t = (k: string) =>
    ({
      ignored_until: "Ignorada hasta",
      ignored_until_trip_end: "Ignorada hasta que termine el viaje",
      returned_after_ignore: "Vuelve tras ignorar",
      resolved_after_ignore: "Resuelta tras ignorar",
      resumed_by: "reanudada por",
    })[k] ?? k;
  const description = { message: "", driver_response: "" };

  it("marks an ignore until a time and who set it", () => {
    const line = holdLine(
      {
        treatment_type: "ignorar condicion",
        description,
        ignored_until: "2026-11-03T15:30:00Z",
        by: "ops@example.com",
      },
      t
    );
    expect(line).toMatch(/^Ignorada hasta 12:30/);
    expect(line).toContain("ops@example.com");
  });

  it("marks an ignore until the trip ends", () => {
    expect(
      holdLine(
        {
          treatment_type: "ignorar condicion",
          description,
          until_trip_end: true,
        },
        t
      )
    ).toBe("Ignorada hasta que termine el viaje");
  });

  it("marks the end of a hold, and who resumed it", () => {
    const end = {
      treatment_type: "fin de ignorar",
      description,
      resolution: "returned_after_ignore",
    };
    expect(holdLine({ ...end, by: "system" }, t)).toBe("Vuelve tras ignorar");
    expect(holdLine({ ...end, by: "lead@example.com" }, t)).toBe(
      "Vuelve tras ignorar · reanudada por lead@example.com"
    );
  });

  it("leaves other rows alone", () => {
    expect(
      holdLine({ treatment_type: "llamar al conductor", description }, t)
    ).toBeNull();
  });
});

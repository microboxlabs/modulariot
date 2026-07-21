import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// The workspace package ships source (no dist build in CI for app tests);
// the chip only pulls one hook from it, so mock at the boundary.
vi.mock("@microboxlabs/miot-calendar-ui", () => ({
  useScrollIntoViewWhen: () => ({ current: null }),
}));

import { PlannedServiceChip } from "./planned-service-chip";
import type { PlannedService } from "./planning-selection-context";

function plannedService(workflowStage?: string): PlannedService {
  return {
    service: {
      id: "1658427-V",
      cliente: "ACME",
      origen: "ANF",
      lugarCarguio: "",
      destino: "SPC",
      tipoViaje: "Rampla",
      ocupacion: 0,
      permanencia: "",
      leadTime: {
        total_lineasoc_cumplen: 0,
        total_lineasoc_incumplen: 0,
        lineasoc_pctn_cumplimiento: 0,
      },
      eta: "",
      incidencias: [],
      observaciones: "",
      prioridad: 0,
      mintral_serviceCode: "1658427",
    },
    slot: { date: new Date("2026-07-13T00:00:00Z"), hour: 5, minutes: 0 },
    ...(workflowStage ? { workflowStage } : {}),
  };
}

function renderChip(workflowStage?: string) {
  return render(
    <PlannedServiceChip
      plannedService={plannedService(workflowStage)}
      onContextMenu={vi.fn()}
      dict={{}}
    />
  );
}

describe("PlannedServiceChip — workflow stage rendering", () => {
  it("renders the plain planned look when no stage is known", () => {
    renderChip();
    const button = screen.getByRole("button");
    expect(button.className).not.toContain("opacity-60");
    expect(screen.queryByLabelText(/^workflow-stage-/)).toBeNull();
  });

  it("marks a finished service muted with a check indicator", () => {
    renderChip("finished");
    const button = screen.getByRole("button");
    expect(button.className).toContain("opacity-60");
    expect(screen.getByLabelText("workflow-stage-finished")).toBeTruthy();
  });

  it("marks a cancelled service muted with a cross indicator", () => {
    renderChip("cancelled");
    const button = screen.getByRole("button");
    expect(button.className).toContain("opacity-60");
    expect(screen.getByLabelText("workflow-stage-cancelled")).toBeTruthy();
  });

  it("marks an in-course service with the en-route indicator, not muted", () => {
    renderChip("monitorTrip");
    const button = screen.getByRole("button");
    expect(button.className).not.toContain("opacity-60");
    expect(screen.getByLabelText("workflow-stage-monitorTrip")).toBeTruthy();
  });

  it("keeps planning-segment stages on the plain look", () => {
    renderChip("assignDriver");
    expect(screen.queryByLabelText(/^workflow-stage-/)).toBeNull();
  });
});

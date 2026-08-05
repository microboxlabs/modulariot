import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// The workspace package ships source (no dist build in CI for app tests);
// the chip only pulls one hook from it, so mock at the boundary.
vi.mock("@microboxlabs/miot-calendar-ui", () => ({
  useScrollIntoViewWhen: () => ({ current: null }),
}));

import { PlannedServiceChip } from "./planned-service-chip";
import type { PlannedService } from "./planning-selection-context";

function plannedService(
  workflowStage?: string,
  syncStatus?: PlannedService["syncStatus"],
  syncDetail?: string,
  serviceOverrides?: Partial<PlannedService["service"]>
): PlannedService {
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
      ...serviceOverrides,
    },
    slot: { date: new Date("2026-07-13T00:00:00Z"), hour: 5, minutes: 0 },
    ...(workflowStage ? { workflowStage } : {}),
    ...(syncStatus ? { syncStatus } : {}),
    ...(syncDetail ? { syncDetail } : {}),
  };
}

const dict = {
  pages: {
    planning: {
      sidebar: {
        assignment: {
          carrier: "Transportista",
          driver: "Conductor",
          secondDriver: "Segundo Conductor",
          truck: "Camión",
          trailer: "Remolque",
          enabled: "Acreditado",
          notEnabled: "No Acreditado",
          superAccredited: "Súper Acreditado",
        },
      },
    },
  },
};

function renderChip(
  workflowStage?: string,
  syncStatus?: PlannedService["syncStatus"],
  syncDetail?: string
) {
  return render(
    <PlannedServiceChip
      plannedService={plannedService(workflowStage, syncStatus, syncDetail)}
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

describe("PlannedServiceChip — sync status dot", () => {
  it("renders no sync dot when the booking is untracked", () => {
    renderChip();
    expect(screen.queryByLabelText(/^sync-status-/)).toBeNull();
  });

  it("renders a grey dot for a PENDING sync", () => {
    renderChip(undefined, "PENDING");
    const dot = screen.getByLabelText("sync-status-pending");
    expect(dot.getAttribute("class")).toContain("text-gray-400");
  });

  it("renders a green dot for a CONFIRMED sync", () => {
    renderChip(undefined, "CONFIRMED");
    const dot = screen.getByLabelText("sync-status-confirmed");
    expect(dot.getAttribute("class")).toContain("text-emerald-500");
  });

  it("renders a red dot for a REJECTED sync and shows the reason on hover", () => {
    renderChip(undefined, "REJECTED", "CONDUCTOR2 NO EXISTE");
    const dot = screen.getByLabelText("sync-status-rejected");
    expect(dot.getAttribute("class")).toContain("text-red-500");
    // Reason tooltip lives on the wrapper.
    expect(screen.getByTitle(/CONDUCTOR2 NO EXISTE/)).toBeTruthy();
  });

  it("shows the sync dot independently of the workflow stage", () => {
    renderChip("finished", "REJECTED");
    expect(screen.getByLabelText("workflow-stage-finished")).toBeTruthy();
    expect(screen.getByLabelText("sync-status-rejected")).toBeTruthy();
  });
});

describe("PlannedServiceChip — assignment accreditation", () => {
  it.each([
    ["accredited", "text-gray-700", "Acreditado"],
    ["notAccredited", "text-amber-700", "No Acreditado"],
    ["superAccredited", "text-green-700", "Súper Acreditado"],
  ] as const)(
    "uses the %s color on the driver icon without rendering a label",
    (level, colorClass, label) => {
      render(
        <PlannedServiceChip
          plannedService={plannedService(undefined, undefined, undefined, {
            assignedDriver: "driver-1",
            assignedDriverAccreditation: level,
          })}
          onContextMenu={vi.fn()}
          dict={dict}
        />
      );

      const icon = screen.getByLabelText("assigned-driver");
      expect(icon.getAttribute("class")).toContain(colorClass);
      expect(screen.queryByText(label)).toBeNull();
      expect(screen.getByTitle(`Conductor: ${label}`)).toBeTruthy();
    }
  );

  it("uses the same accreditation color and tooltip for two drivers", () => {
    render(
      <PlannedServiceChip
        plannedService={plannedService(undefined, undefined, undefined, {
          assignedDriver: "driver-1",
          assignedDriverAccreditation: "superAccredited",
          assignedDriver2: "driver-2",
          assignedDriver2Accreditation: "accredited",
        })}
        onContextMenu={vi.fn()}
        dict={dict}
      />
    );

    const icon = screen.getByLabelText("assigned-drivers");
    expect(icon.getAttribute("class")).toContain("text-gray-700");
    expect(
      screen.getByTitle(
        /Conductor: Súper Acreditado\s+Segundo Conductor: Acreditado/
      )
    ).toBeTruthy();
  });
});

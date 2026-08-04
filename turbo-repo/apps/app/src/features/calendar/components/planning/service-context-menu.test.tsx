import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlannedService } from "./planning-selection-context";
import { ServiceContextMenu } from "./service-context-menu";

vi.mock("./use-calendar-view-mode", () => ({
  useCalendarViewMode: () => ({
    canPlan: true,
    canAssign: true,
  }),
}));

vi.mock("./planning-selection-context", () => ({
  usePlanningSelection: () => ({
    inspectPlannedService: vi.fn(),
  }),
}));

vi.mock("@/features/calendar/services/task-driven-guard", () => ({
  canAssignAtStage: () => true,
  canReplanAtStage: () => true,
}));

vi.mock("@/features/calendar/services/use-task-driven-origins", () => ({
  useTaskDrivenOrigins: () => [],
}));

const plannedService: PlannedService = {
  service: {
    id: "1659176-V",
    cliente: "ACME",
    origen: "CPP",
    lugarCarguio: "",
    destino: "CAS",
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
    mintral_serviceCode: "1659176",
  },
  slot: { date: new Date("2026-08-04T00:00:00Z"), hour: 9, minutes: 45 },
};

const dict = {
  pages: {
    planning: {
      sidebar: {
        contextMenu: {
          service: "Servicio",
          assign: "Asignar",
          deleteAssignment: "Eliminar asignación",
          replan: "Volver a planificar",
          deletePlanning: "Eliminar planificación",
          openReadOnly: "Abrir servicio (Solo Lectura)",
          previewAsViewer: "Previsualizar como visor",
        },
      },
    },
  },
};

describe("ServiceContextMenu", () => {
  it("keeps the read-only action without rendering the duplicate viewer preview", () => {
    render(
      <ServiceContextMenu
        isOpen
        position={{ x: 0, y: 0 }}
        plannedService={plannedService}
        onReassign={vi.fn()}
        onAssign={vi.fn()}
        onDelete={vi.fn()}
        onDeleteAssignment={vi.fn()}
        onClose={vi.fn()}
        dict={dict}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Abrir servicio (Solo Lectura)",
      })
    ).toBeTruthy();
    expect(screen.queryByText("Previsualizar como visor")).toBeNull();
  });
});

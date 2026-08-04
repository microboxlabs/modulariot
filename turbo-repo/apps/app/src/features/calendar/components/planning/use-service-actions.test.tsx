import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannedService } from "./planning-selection-context";
import { useServiceActions } from "./use-service-actions";

const { showNotification } = vi.hoisted(() => ({
  showNotification: vi.fn(),
}));

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: showNotification,
}));

const PLANNED_SERVICE: PlannedService = {
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
  slot: { date: new Date("2026-08-04T00:00:00Z"), hour: 9, minutes: 0 },
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useServiceActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables remove-plan confirmation and ignores duplicate submissions while pending", async () => {
    const pending = deferred();
    const removeService = vi.fn(() => pending.promise);
    const { result } = renderHook(() =>
      useServiceActions({
        removeService,
        removeAssignment: vi.fn(),
        startReassignment: vi.fn(),
        startAssignment: vi.fn(),
      })
    );

    act(() => {
      result.current.handleDeleteRequest(PLANNED_SERVICE);
    });

    let firstRequest!: Promise<void>;
    let duplicateRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.handleConfirmDelete(PLANNED_SERVICE);
      duplicateRequest = result.current.handleConfirmDelete(PLANNED_SERVICE);
    });

    expect(result.current.deleteModal.isProcessing).toBe(true);
    expect(removeService).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
      await Promise.all([firstRequest, duplicateRequest]);
    });

    expect(result.current.deleteModal).toEqual({
      isOpen: false,
      plannedService: null,
      isProcessing: false,
    });
    expect(removeService).toHaveBeenCalledTimes(1);
  });
});

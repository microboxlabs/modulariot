import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { TowerAction, TowerTreatment } from "@/features/symptoms/control-tower/control-tower-api";
import { TreatmentSessionProvider, useTreatmentSession } from "./treatment-session";

const api = vi.hoisted(() => ({
  openTreatment: vi.fn(),
  addTreatmentAction: vi.fn(),
  closeTreatment: vi.fn(),
  cancelTreatment: vi.fn(),
}));

vi.mock("swr", () => ({ mutate: vi.fn() }));
vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  ...api,
  contactsKey: "contacts",
  treatmentsKey: (id: number) => `treatments-${id}`,
}));

function treatment(status: TowerTreatment["status"]): TowerTreatment {
  return {
    id: "t1",
    symptomId: 7,
    assetId: null,
    tripId: null,
    type: "INVALIDATE_SYMPTOM",
    status,
    openedBy: "op",
    openedAt: "2026-09-24T00:00:00Z",
    closedBy: null,
    closedAt: null,
    resolution: null,
    note: null,
    updatedAt: "2026-09-24T00:00:00Z",
    actions: [],
  };
}

function renderSession() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreatmentSessionProvider symptomId={7}>{children}</TreatmentSessionProvider>
  );
  return renderHook(() => useTreatmentSession(), { wrapper });
}

describe("TreatmentSessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.openTreatment.mockResolvedValue(treatment("OPEN"));
    api.addTreatmentAction.mockResolvedValue({ id: "a1" } as TowerAction);
    api.closeTreatment.mockResolvedValue(treatment("CLOSED"));
    api.cancelTreatment.mockResolvedValue(treatment("CANCELLED"));
  });

  it("closes the episode only once when finish is retried", async () => {
    const { result } = renderSession();

    await act(async () => {
      await result.current.ensureOpen("INVALIDATE_SYMPTOM");
      await result.current.addAction({ kind: "INVALIDATE", outcomeKey: "r", note: "n" });
      await result.current.finish("invalidated");
      await result.current.finish("invalidated");
    });

    expect(api.closeTreatment).toHaveBeenCalledTimes(1);
  });

  it("retries the close when the first attempt failed", async () => {
    api.closeTreatment.mockRejectedValueOnce(new Error("network"));
    const { result } = renderSession();

    await act(async () => {
      await result.current.ensureOpen("INVALIDATE_SYMPTOM");
      await expect(result.current.finish("invalidated")).rejects.toThrow("network");
      await result.current.finish("invalidated");
    });

    expect(api.closeTreatment).toHaveBeenCalledTimes(2);
    expect(result.current.treatment?.status).toBe("CLOSED");
  });
});

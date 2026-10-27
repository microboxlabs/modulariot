import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";

const tower = vi.hoisted(() => ({
  openTreatment: vi.fn(),
  addTreatmentAction: vi.fn(),
  closeTreatment: vi.fn(),
}));
const legacy = vi.hoisted(() => ({ requestTreatment: vi.fn() }));

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => tower);
vi.mock("@/features/common/providers/client-api.provider", () => legacy);
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  getRuntimeConfig: () => ({}),
}));

import {
  guardedFinishTreatment,
  guardedInvalidateSymptom,
  guardedRequestTreatment,
  startPendingTreatment,
} from "./prototype-api-guard";

const base: TreatmentsRequest = {
  asset_id: "BCF918",
  assigned_to: "operator@example.com",
  client_id: null,
  status: "active",
  symptom_id: "-16",
  treatment_type: "",
  trip_id: "trip-1",
  treatment_id: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  tower.openTreatment.mockResolvedValue({ id: "t-1", type: "CALL" });
  tower.addTreatmentAction.mockResolvedValue({});
  tower.closeTreatment.mockResolvedValue({});
  legacy.requestTreatment.mockImplementation(async (p) => ({
    ...p,
    treatment_id: 7,
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}"))
  );
});

describe("treatments on an engine case", () => {
  it("invalidating records the reason and closes the treatment, without the GPS RPC or the webhook", async () => {
    await guardedInvalidateSymptom({
      treatmentRequest: base,
      setTreatmentRequest: vi.fn(),
      treatmentData: null,
      reason: "Motivo: prueba",
    });

    expect(tower.openTreatment).toHaveBeenCalledWith("-16", {
      type: "INVALIDATE_SYMPTOM",
      assetId: "BCF918",
      tripId: "trip-1",
    });
    expect(tower.addTreatmentAction).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        kind: "INVALIDATE",
        outcomeLabel: "Motivo: prueba",
      })
    );
    expect(tower.closeTreatment).toHaveBeenCalledWith("t-1", {
      resolution: "Motivo: prueba",
    });
    expect(legacy.requestTreatment).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignoring records an IGNORE action with the reason", async () => {
    await guardedRequestTreatment({
      ...base,
      treatment_type: "ignorar condicion",
      description: "Motivo: falsa alarma",
    });

    expect(tower.addTreatmentAction).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        kind: "IGNORE",
        outcomeLabel: "Motivo: falsa alarma",
      })
    );
    expect(tower.closeTreatment).toHaveBeenCalled();
  });

  it("a call saved to make another one keeps the treatment open until it finishes", async () => {
    await guardedRequestTreatment(base, {
      finish: false,
      action: { contactName: "Juan", durationSeconds: 30 },
    });

    expect(tower.addTreatmentAction).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        kind: "CALL",
        contactName: "Juan",
        durationSeconds: 30,
      })
    );
    expect(tower.closeTreatment).not.toHaveBeenCalled();

    await guardedFinishTreatment(base);
    expect(tower.closeTreatment).toHaveBeenCalledWith("t-1", {});
  });

  it("opening a form records nothing", async () => {
    await startPendingTreatment(base, vi.fn(), "llamar al conductor");

    expect(legacy.requestTreatment).not.toHaveBeenCalled();
    expect(tower.openTreatment).not.toHaveBeenCalled();
  });
});

describe("treatments on a GPS database symptom", () => {
  const gps = { ...base, symptom_id: "4512" };

  it("keep going through the treatments RPC", async () => {
    const saved = await guardedRequestTreatment({
      ...gps,
      treatment_type: "ignorar condicion",
    });

    expect(saved.treatment_id).toBe(7);
    expect(tower.openTreatment).not.toHaveBeenCalled();
  });

  it("finishing has nothing to close", async () => {
    await guardedFinishTreatment(gps);

    expect(tower.openTreatment).not.toHaveBeenCalled();
    expect(tower.closeTreatment).not.toHaveBeenCalled();
  });
});

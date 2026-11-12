import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";

const tower = vi.hoisted(() => ({
  ControlTowerError: class extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
    }
  },
  openTreatment: vi.fn(),
  addTreatmentAction: vi.fn(),
  closeTreatment: vi.fn(),
  cancelTreatment: vi.fn(),
  revalidateCase: vi.fn(),
}));
const config = vi.hoisted(() => ({ disabled: false }));

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => tower);
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  getRuntimeConfig: () => ({
    SYMPTOMS_PROTOTYPE_DISABLE_API: config.disabled ? "true" : "false",
  }),
}));

import {
  forgetStartedTreatments,
  guardedAbandonTreatment,
  guardedFinishTreatment,
  guardedInvalidateSymptom,
  guardedRequestTreatment,
  guardedSkipStep,
  guardedStartTreatment,
  isCaseClosedError,
  RECORD_HANDLING_TYPE,
  treatmentSaveErrorKey,
} from "./prototype-api-guard";

const base: TreatmentsRequest = {
  asset_id: "asset-test",
  assigned_to: "operator-test",
  client_id: null,
  status: "active",
  symptom_id: "-16",
  treatment_type: "",
  trip_id: "trip-1",
  treatment_id: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  forgetStartedTreatments();
  config.disabled = false;
  tower.openTreatment.mockResolvedValue({ id: "t-1", type: "CALL" });
  tower.addTreatmentAction.mockResolvedValue({});
  tower.closeTreatment.mockResolvedValue({});
  tower.cancelTreatment.mockResolvedValue({});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}"))
  );
});

describe("treatments on an engine case", () => {
  it("invalidating records the reason and closes the treatment, without the webhook", async () => {
    await guardedInvalidateSymptom({
      treatmentRequest: base,
      setTreatmentRequest: vi.fn(),
      reason: "Motivo: prueba",
    });

    expect(tower.openTreatment).toHaveBeenCalledWith("-16", {
      type: "INVALIDATE_SYMPTOM",
      assetId: "asset-test",
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
    expect(fetch).not.toHaveBeenCalled();
    expect(tower.revalidateCase).toHaveBeenLastCalledWith("-16");
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
      action: { contactName: "Test driver", durationSeconds: 30 },
    });

    expect(tower.addTreatmentAction).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        kind: "CALL",
        contactName: "Test driver",
        durationSeconds: 30,
      })
    );
    expect(tower.closeTreatment).not.toHaveBeenCalled();
    expect(tower.revalidateCase).toHaveBeenCalledWith("-16");

    tower.revalidateCase.mockClear();
    await guardedFinishTreatment(base);
    expect(tower.closeTreatment).toHaveBeenCalledWith("t-1", {});
    expect(tower.revalidateCase).toHaveBeenCalledWith("-16");
  });

  it("retries a failed close without recording the acknowledged action again", async () => {
    const progress = {};
    tower.closeTreatment.mockRejectedValueOnce(new Error("case close failed"));
    tower.openTreatment.mockResolvedValueOnce({ id: "t-1" });
    tower.openTreatment.mockResolvedValue({ id: "t-2" });

    await expect(
      guardedRequestTreatment({ ...base }, { progress })
    ).rejects.toThrow("case close failed");
    expect(tower.revalidateCase).toHaveBeenCalledWith(base.symptom_id);
    await guardedRequestTreatment({ ...base }, { progress });

    expect(tower.openTreatment).toHaveBeenCalledTimes(1);
    expect(tower.addTreatmentAction).toHaveBeenCalledTimes(1);
    expect(tower.closeTreatment.mock.calls).toEqual([
      ["t-1", {}],
      ["t-1", {}],
    ]);
  });

  it("adds the next call to the treatment it opened, even after the engine closed the case", async () => {
    const progress = {};
    await guardedRequestTreatment(base, { finish: false, progress });
    tower.openTreatment.mockRejectedValue(
      new tower.ControlTowerError("the case is closed", 409)
    );

    await guardedRequestTreatment(base, { progress });

    expect(tower.openTreatment).toHaveBeenCalledTimes(1);
    expect(tower.addTreatmentAction.mock.calls.map(([id]) => id)).toEqual([
      "t-1",
      "t-1",
    ]);
    expect(tower.closeTreatment).toHaveBeenCalledWith("t-1", {});
  });

  it("looks up the open treatment again when the remembered one was closed elsewhere", async () => {
    const progress = {};
    await guardedRequestTreatment(base, { finish: false, progress });
    tower.addTreatmentAction.mockRejectedValueOnce(
      new tower.ControlTowerError("treatment is CLOSED", 409)
    );
    tower.openTreatment.mockResolvedValue({ id: "t-2" });

    await guardedRequestTreatment(base, { progress });

    expect(tower.addTreatmentAction.mock.calls.map(([id]) => id)).toEqual([
      "t-1",
      "t-1",
      "t-2",
    ]);
    expect(tower.closeTreatment).toHaveBeenCalledWith("t-2", {});
  });

  it("names a refusal on a closed case apart from other failures", async () => {
    const closed = new tower.ControlTowerError("the case is closed", 409);
    tower.openTreatment.mockRejectedValueOnce(closed);

    const error = await guardedRequestTreatment(base).catch((e) => e);

    expect(error).toBe(closed);
    expect(isCaseClosedError(error)).toBe(true);
    expect(treatmentSaveErrorKey(error)).toBe("treatment_case_closed");
    expect(treatmentSaveErrorKey(new Error("network"))).toBe(
      "treatment_save_error"
    );
    expect(
      treatmentSaveErrorKey(
        new tower.ControlTowerError("treatment is CLOSED", 409)
      )
    ).toBe("treatment_save_error");
    expect(tower.addTreatmentAction).not.toHaveBeenCalled();
  });

  it("retries finishing the same treatment if the case close failed after it closed", async () => {
    const progress = {};
    tower.closeTreatment.mockRejectedValueOnce(new Error("case close failed"));
    tower.openTreatment.mockResolvedValueOnce({ id: "t-1" });
    tower.openTreatment.mockResolvedValue({ id: "t-2" });

    await expect(guardedFinishTreatment(base, progress)).rejects.toThrow(
      "case close failed"
    );
    expect(tower.revalidateCase).toHaveBeenCalledWith(base.symptom_id);
    await guardedFinishTreatment(base, progress);

    expect(tower.openTreatment).toHaveBeenCalledTimes(1);
    expect(tower.addTreatmentAction).not.toHaveBeenCalled();
    expect(tower.closeTreatment.mock.calls).toEqual([
      ["t-1", {}],
      ["t-1", {}],
    ]);
  });
});

describe("the treatment opened when the operator starts", () => {
  const caseClosed = () =>
    new tower.ControlTowerError("the case is closed", 409);

  it("opens it once and revalidates the case", async () => {
    await guardedStartTreatment(base);
    await guardedStartTreatment(base);

    expect(tower.openTreatment).toHaveBeenCalledTimes(1);
    expect(tower.openTreatment).toHaveBeenCalledWith("-16", {
      type: "CALL",
      assetId: "asset-test",
      tripId: "trip-1",
    });
    expect(tower.revalidateCase).toHaveBeenCalledTimes(1);
  });

  it("opens it with the type of the form the panel opened on", async () => {
    await guardedStartTreatment({
      ...base,
      treatment_type: "invalidar sintoma",
    });

    expect(tower.openTreatment.mock.calls[0][1].type).toBe(
      "INVALIDATE_SYMPTOM"
    );
  });

  it("records a save into it after the engine closed the case", async () => {
    await guardedStartTreatment(base);
    tower.openTreatment.mockRejectedValue(caseClosed());

    await guardedRequestTreatment({ ...base, description: "Contactado" });

    expect(tower.openTreatment).toHaveBeenCalledTimes(1);
    expect(tower.addTreatmentAction.mock.calls[0][0]).toBe("t-1");
    expect(tower.closeTreatment).toHaveBeenCalledWith("t-1", {
      resolution: "Contactado",
    });
  });

  it("records a call-step skip into it after the engine closed the case", async () => {
    await guardedStartTreatment(base);
    tower.openTreatment.mockRejectedValue(caseClosed());

    await guardedSkipStep({
      symptomId: -16,
      toStep: 1,
      reason: "No contesta",
      skipId: "skip-1",
    });

    expect(tower.addTreatmentAction.mock.calls[0][0]).toBe("t-1");
  });

  it("is refused on a case that was already closed", async () => {
    tower.openTreatment.mockRejectedValue(caseClosed());

    const refusal = await guardedStartTreatment(base).catch((e) => e);

    expect(isCaseClosedError(refusal)).toBe(true);
    expect(tower.revalidateCase).not.toHaveBeenCalled();
  });

  it("opens again after a failed try", async () => {
    tower.openTreatment.mockRejectedValueOnce(new Error("network"));
    await expect(guardedStartTreatment(base)).rejects.toThrow("network");

    await guardedStartTreatment(base);

    expect(tower.openTreatment).toHaveBeenCalledTimes(2);
  });

  it("is cancelled when the operator leaves without recording anything", async () => {
    await guardedStartTreatment(base);

    await guardedAbandonTreatment(base.symptom_id);

    expect(tower.cancelTreatment).toHaveBeenCalledWith(
      "t-1",
      "panel closed",
      {}
    );
    expect(tower.revalidateCase).toHaveBeenCalledTimes(2);
  });

  it("is cancelled once it opens when the operator left before that", async () => {
    let opened: (treatment: { id: string }) => void = () => {};
    tower.openTreatment.mockReturnValue(
      new Promise((resolve) => (opened = resolve))
    );
    const starting = guardedStartTreatment(base);
    const leaving = guardedAbandonTreatment(base.symptom_id);
    expect(tower.cancelTreatment).not.toHaveBeenCalled();

    opened({ id: "t-1" });
    await Promise.all([starting, leaving]);

    expect(tower.cancelTreatment).toHaveBeenCalledTimes(1);
  });

  it("lets the cancel outlive the page", async () => {
    await guardedStartTreatment(base);

    await guardedAbandonTreatment(base.symptom_id, { keepalive: true });

    expect(tower.cancelTreatment).toHaveBeenCalledWith("t-1", "panel closed", {
      keepalive: true,
    });
  });

  it("stays open when an action was recorded in it", async () => {
    await guardedStartTreatment(base);
    await guardedRequestTreatment(base, { finish: false });

    await guardedAbandonTreatment(base.symptom_id);

    expect(tower.cancelTreatment).not.toHaveBeenCalled();
  });

  it("stays open while an action is being recorded", async () => {
    await guardedStartTreatment(base);
    let recorded: (action: object) => void = () => {};
    tower.addTreatmentAction.mockReturnValue(
      new Promise((resolve) => (recorded = resolve))
    );
    const saving = guardedRequestTreatment(base, { finish: false });
    await Promise.resolve();

    await guardedAbandonTreatment(base.symptom_id);
    recorded({});
    await saving;

    expect(tower.cancelTreatment).not.toHaveBeenCalled();
  });

  it("stays open when it was resumed with actions from before", async () => {
    tower.openTreatment.mockResolvedValue({ id: "t-1", actions: [{}] });
    await guardedStartTreatment(base);

    await guardedAbandonTreatment(base.symptom_id);

    expect(tower.cancelTreatment).not.toHaveBeenCalled();
  });

  it("opens the next one only after the cancel of the abandoned one", async () => {
    await guardedStartTreatment(base);
    let cancelled: (treatment: object) => void = () => {};
    tower.cancelTreatment.mockReturnValue(
      new Promise((resolve) => (cancelled = resolve))
    );
    void guardedAbandonTreatment(base.symptom_id);

    const restarting = guardedStartTreatment(base);
    await Promise.resolve();
    expect(tower.openTreatment).toHaveBeenCalledTimes(1);
    cancelled({});
    await restarting;

    expect(tower.openTreatment).toHaveBeenCalledTimes(2);
  });

  it("has nothing to cancel after the treatment was finished", async () => {
    await guardedStartTreatment(base);
    await guardedRequestTreatment(base);

    await guardedAbandonTreatment(base.symptom_id);

    expect(tower.cancelTreatment).not.toHaveBeenCalled();
  });

  it("opens nothing with the API off or outside the Control Tower", async () => {
    await guardedStartTreatment({ ...base, symptom_id: "16" });
    config.disabled = true;
    await guardedStartTreatment(base);
    await guardedAbandonTreatment(base.symptom_id);

    expect(tower.openTreatment).not.toHaveBeenCalled();
    expect(tower.cancelTreatment).not.toHaveBeenCalled();
  });
});

describe("treatments on a symptom that is not an engine case", () => {
  const gps = { ...base, symptom_id: "4512" };

  it.each([
    [RECORD_HANDLING_TYPE, false],
    [RECORD_HANDLING_TYPE, true],
    ["ignorar condicion", false],
    ["ignorar condicion", true],
  ])(
    "refuses %s without writing anything (API disabled: %s)",
    async (treatment_type, disabled) => {
      config.disabled = disabled;

      await expect(
        guardedRequestTreatment({ ...gps, treatment_type })
      ).rejects.toThrow("Treatments require an engine case");

      expect(fetch).not.toHaveBeenCalled();
      expect(tower.openTreatment).not.toHaveBeenCalled();
      expect(tower.addTreatmentAction).not.toHaveBeenCalled();
      expect(tower.closeTreatment).not.toHaveBeenCalled();
      expect(tower.revalidateCase).not.toHaveBeenCalled();
    }
  );

  it("invalidating is refused without calling the webhook", async () => {
    await expect(
      guardedInvalidateSymptom({
        treatmentRequest: gps,
        setTreatmentRequest: vi.fn(),
        reason: "Motivo: prueba",
      })
    ).rejects.toThrow("Treatments require an engine case");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("finishing has nothing to close", async () => {
    await guardedFinishTreatment(gps);

    expect(tower.openTreatment).not.toHaveBeenCalled();
    expect(tower.closeTreatment).not.toHaveBeenCalled();
  });
});

describe("call-step skips", () => {
  it("records a NOTE with the 1-based step in the operator's open treatment", async () => {
    await guardedSkipStep({
      symptomId: -16,
      assetId: "asset-test",
      tripId: "",
      toStep: 1,
      reason: "No contesta",
      level: 3,
      version: "4",
      skipId: "skip-1",
      slaSince: "2026-11-05T12:00:00Z",
    });

    expect(tower.openTreatment).toHaveBeenCalledWith(-16, {
      type: "CALL",
      assetId: "asset-test",
      tripId: undefined,
    });
    expect(tower.addTreatmentAction).toHaveBeenCalledWith("t-1", {
      kind: "NOTE",
      note: "No contesta",
      details: {
        skipToStep: 2,
        level: 3,
        version: "4",
        skipId: "skip-1",
        slaSince: "2026-11-05T12:00:00Z",
      },
    });
    expect(tower.closeTreatment).not.toHaveBeenCalled();
    expect(tower.revalidateCase).toHaveBeenCalledWith(-16);
  });

  it("writes nothing for a case outside the Control Tower", async () => {
    await guardedSkipStep({
      symptomId: 16,
      toStep: 1,
      reason: "x",
      skipId: "skip-1",
    });
    expect(tower.openTreatment).not.toHaveBeenCalled();
    expect(tower.addTreatmentAction).not.toHaveBeenCalled();
  });
});

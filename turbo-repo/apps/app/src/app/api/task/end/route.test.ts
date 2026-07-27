/**
 * P3 — /api/task/end POST gating: the planner's task-driven ASSIGN move
 * threads `processVariables` through this route into the ECM endTask
 * POST shape (ecm-coordinator#262). When the body has no `processVariables`,
 * the kanban form-driven path (`updateTask` + `endTask`-GET) is unchanged.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const authMock = vi.fn();
const endTaskMock = vi.fn();
const updateTaskMock = vi.fn();
const getChildrenNodesMock = vi.fn();
const listContentTopicsMock = vi.fn();
const getReviewRoundsMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock("@/features/common/providers/alfresco-api/alfresco-api.provider", () => ({
  endTask: (...args: unknown[]) => endTaskMock(...args),
  updateTask: (...args: unknown[]) => updateTaskMock(...args),
  getChildrenNodes: (...args: unknown[]) => getChildrenNodesMock(...args),
  listContentTopics: (...args: unknown[]) => listContentTopicsMock(...args),
  getReviewRounds: (...args: unknown[]) => getReviewRoundsMock(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logError: vi.fn(),
}));

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/task/end", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const TASK_DRIVEN_VARS = {
  carrier_id: "carrier-uuid",
  driver_id: "driver-uuid",
  driver2_id: null,
  truck_id: "truck-uuid",
  trailer_id: null,
  carrier_external_id: "PRVE-001",
  tipo_servicio: "SIDER",
} as const;

describe("POST /api/task/end — P3 processVariables routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    endTaskMock.mockResolvedValue({});
    updateTaskMock.mockResolvedValue(undefined);
  });

  it("body with processVariables: skips updateTask and POSTs endTask with the tuple", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      makePostRequest({
        taskId: "task-1",
        transitionId: "Presentar Conductor",
        processVariables: TASK_DRIVEN_VARS,
      })
    );

    expect(response.status).toBe(200);
    expect(updateTaskMock).not.toHaveBeenCalled();
    expect(endTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      "task-1",
      "Presentar Conductor",
      TASK_DRIVEN_VARS
    );
  });

  it("body without processVariables: runs the kanban updateTask + GET endTask path (unchanged)", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      makePostRequest({
        taskId: "task-1",
        transitionId: "Planificar Servicio",
      })
    );

    expect(response.status).toBe(200);
    expect(updateTaskMock).toHaveBeenCalledTimes(1);
    expect(endTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      "task-1",
      "Planificar Servicio"
    );
    // The 4th arg is omitted for the legacy path — provider's default GET.
    expect(endTaskMock.mock.calls[0]).toHaveLength(3);
  });
});

/**
 * The rejected-documents gate exists to stop the workflow advancing over unresolved
 * reviews. "Preparar Servicio" is an advance out of Presentar Conductor but a rejection
 * when sent back from Iniciar Viaje, so classifying by label alone blocked the very move
 * a rejection needs.
 */
describe("POST /api/task/end — document-review gating is direction-aware", () => {
  const BPM_PACKAGE = "workspace://SpacesStore/83c596eb-159a-4037-8596-eb159ab0377a";

  function reviewable(id: string, reviewStatus: string) {
    return {
      entry: {
        id,
        aspectNames: ["mintral:reviewableAspect"],
        properties: { "mintral:reviewStatus": reviewStatus },
      },
    };
  }

  function docs(...entries: ReturnType<typeof reviewable>[]) {
    return { list: { entries } };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    endTaskMock.mockResolvedValue({});
    updateTaskMock.mockResolvedValue(undefined);
    // Every rejected document carries a reason, so REJECTED_WITHOUT_OBSERVATIONS never fires
    // and the direction logic is what these tests actually exercise. Both sources are stubbed
    // because the gate reads rounds first and only falls back to the forum.
    getReviewRoundsMock.mockResolvedValue({
      rounds: [{ seq: 1, verdict: "REJECTED", reasons: ["wrong_format"], comment: "" }],
    });
    listContentTopicsMock.mockResolvedValue({
      topics: [{ title: "Prueba de integración" }],
    });
  });

  async function post(body: Record<string, unknown>) {
    const { POST } = await loadRoute();
    return POST(makePostRequest({ taskId: "2983101", bpm_package: BPM_PACKAGE, ...body }));
  }

  it("allows rejecting back to Preparar Servicio from Iniciar Viaje with rejected documents", async () => {
    getChildrenNodesMock.mockResolvedValue(
      docs(reviewable("a", "APPROVED"), reviewable("b", "REJECTED"))
    );

    const response = await post({
      transitionId: "Preparar Servicio",
      reasonId: "wfship2:missionControlTask",
    });

    expect(response.status).toBe(200);
    expect(endTaskMock).toHaveBeenCalled();
  });

  it("still blocks advancing to Preparar Servicio from Presentar Conductor with rejected documents", async () => {
    getChildrenNodesMock.mockResolvedValue(docs(reviewable("b", "REJECTED")));

    const response = await post({
      transitionId: "Preparar Servicio",
      reasonId: "wfship2:presentDriverTask",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REJECTED_DOCUMENTS" },
    });
    expect(endTaskMock).not.toHaveBeenCalled();
  });

  it("still blocks a genuine advance out of Iniciar Viaje with rejected documents", async () => {
    getChildrenNodesMock.mockResolvedValue(docs(reviewable("b", "REJECTED")));

    const response = await post({
      transitionId: "Monitorear viaje en curso",
      reasonId: "wfship2:missionControlTask",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REJECTED_DOCUMENTS" },
    });
  });

  it("does not block a return when documents are still pending review", async () => {
    getChildrenNodesMock.mockResolvedValue(docs(reviewable("a", "PENDING")));

    const response = await post({
      transitionId: "Preparar Servicio",
      reasonId: "wfship2:missionControlTask",
    });

    expect(response.status).toBe(200);
  });

  it("still blocks an advance when documents are pending review", async () => {
    getChildrenNodesMock.mockResolvedValue(docs(reviewable("a", "PENDING")));

    const response = await post({
      transitionId: "Monitorear viaje en curso",
      reasonId: "wfship2:missionControlTask",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNREVIEWED_DOCUMENTS" },
    });
  });

  it("falls back to the label when the source stage is unknown", async () => {
    getChildrenNodesMock.mockResolvedValue(docs(reviewable("b", "REJECTED")));

    const response = await post({ transitionId: "Preparar Servicio" });

    expect(response.status).toBe(422);
  });
});

/**
 * Where a rejection's reason is read from.
 *
 * A rejection is recorded as a review round, and the forum write that used to accompany it is
 * gone. This gate went on asking the forum, so every rounds-era rejection looked unexplained
 * and sending the trip back — the one move a rejection needs — was refused, with the reasons
 * and the comment on screen in the confirm dialog the whole time.
 */
describe("POST /api/task/end — a rejection's reason comes from its round", () => {
  const BPM_PACKAGE = "workspace://SpacesStore/83c596eb-159a-4037-8596-eb159ab0377a";

  const rejectedDoc = {
    list: {
      entries: [
        {
          entry: {
            id: "b",
            aspectNames: ["mintral:reviewableAspect"],
            properties: { "mintral:reviewStatus": "REJECTED" },
          },
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    endTaskMock.mockResolvedValue({});
    updateTaskMock.mockResolvedValue(undefined);
    getChildrenNodesMock.mockResolvedValue(rejectedDoc);
    // No forum topics anywhere: a rounds-era rejection has none, and leaving the old source
    // empty is what makes these assertions about rounds rather than about the fallback.
    listContentTopicsMock.mockResolvedValue({ topics: [] });
  });

  async function sendBack() {
    const { POST } = await loadRoute();
    return POST(
      makePostRequest({
        taskId: "2986645",
        bpm_package: BPM_PACKAGE,
        transitionId: "Preparar Servicio",
        reasonId: "wfship2:missionControlTask",
      })
    );
  }

  it("allows the return when the latest round carries reason codes", async () => {
    getReviewRoundsMock.mockResolvedValue({
      rounds: [{ seq: 1, verdict: "REJECTED", reasons: ["wrong_format"], comment: "" }],
    });

    expect((await sendBack()).status).toBe(200);
  });

  it("allows the return when the round carries only a comment", async () => {
    // Reasons are optional in the picker; a written explanation is an explanation.
    getReviewRoundsMock.mockResolvedValue({
      rounds: [{ seq: 1, verdict: "REJECTED", reasons: [], comment: "Se requiere un png" }],
    });

    expect((await sendBack()).status).toBe(200);
  });

  it("blocks when the latest round explains nothing", async () => {
    getReviewRoundsMock.mockResolvedValue({
      rounds: [{ seq: 1, verdict: "REJECTED", reasons: [], comment: "   " }],
    });

    const response = await sendBack();
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REJECTED_WITHOUT_OBSERVATIONS" },
    });
  });

  it("judges by the newest round, not by an older one that explained replaced content", async () => {
    getReviewRoundsMock.mockResolvedValue({
      rounds: [
        { seq: 1, verdict: "REJECTED", reasons: ["poor_image_quality"], comment: "Borrosa" },
        { seq: 2, verdict: "REJECTED", reasons: [], comment: "" },
      ],
    });

    expect((await sendBack()).status).toBe(422);
  });

  it("falls back to the forum for content decided before rounds existed", async () => {
    getReviewRoundsMock.mockResolvedValue({ rounds: [] });
    listContentTopicsMock.mockResolvedValue({
      topics: [{ title: "Calidad de imagen deficiente" }],
    });

    expect((await sendBack()).status).toBe(200);
  });

  it("does not count a verdict topic as an observation in that fallback", async () => {
    getReviewRoundsMock.mockResolvedValue({ rounds: [] });
    listContentTopicsMock.mockResolvedValue({ topics: [{ title: "REJECTED" }] });

    expect((await sendBack()).status).toBe(422);
  });
});

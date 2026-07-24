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

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock("@/features/common/providers/alfresco-api/alfresco-api.provider", () => ({
  endTask: (...args: unknown[]) => endTaskMock(...args),
  updateTask: (...args: unknown[]) => updateTaskMock(...args),
  getChildrenNodes: (...args: unknown[]) => getChildrenNodesMock(...args),
  listContentTopics: (...args: unknown[]) => listContentTopicsMock(...args),
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
    // Every rejected document carries an observation, so REJECTED_WITHOUT_OBSERVATIONS
    // never fires and the direction logic is what these tests actually exercise.
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

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

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock("@/features/common/providers/alfresco-api/alfresco-api.provider", () => ({
  endTask: (...args: unknown[]) => endTaskMock(...args),
  updateTask: (...args: unknown[]) => updateTaskMock(...args),
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

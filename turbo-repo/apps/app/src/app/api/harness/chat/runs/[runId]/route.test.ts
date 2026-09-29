import { beforeEach, describe, expect, it, vi } from "vitest";
import { MiotHarnessApiError } from "@microboxlabs/miot-harness-client";

const requireAuthMock = vi.fn();
const runsGetMock = vi.fn();

vi.mock("../../../../utils/alfresco-crud-client", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

vi.mock("../../../../utils/tenant-scope", () => ({
  resolveTenantScope: async () => ({
    resolved: true,
    scope: { activeOrg: { slug: "acme" } },
  }),
}));

vi.mock("@/lib/modulith-host", () => ({
  modulithHost: () => "http://modulith.test",
  isModulithConfigured: () => true,
}));

vi.mock("@microboxlabs/miot-harness-client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@microboxlabs/miot-harness-client")
  >()),
  createMiotHarnessClient: () => ({
    runs: { get: (...args: unknown[]) => runsGetMock(...args) },
  }),
}));

vi.mock("@/features/i18n/i18n.service", () => ({
  getDictionary: async () => [(key: string) => key],
  getLocaleFromHeaders: () => "en",
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./route";

const params = { params: Promise.resolve({ runId: "run_1" }) };
const request = new Request("http://app.test/api/harness/chat/runs/run_1");

describe("GET /api/harness/chat/runs/[runId]", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    runsGetMock.mockReset();
    requireAuthMock.mockResolvedValue({
      authenticated: true,
      session: { user: { rawJWT: "jwt", email: "user@example.com" } },
    });
  });

  it("returns the run's activity", async () => {
    runsGetMock.mockResolvedValue({
      run_id: "run_1",
      status: "completed",
      artifacts: [],
      answer: "",
      conversation_id: null,
      events: [
        {
          id: "e1",
          run_id: "run_1",
          seq: 1,
          type: "tool.started",
          message: "",
          data: { tool: "acs_query", call_id: "c1", args: { sql: "select 1" } },
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const res = await GET(request, params);

    expect(res.status).toBe(200);
    expect(runsGetMock).toHaveBeenCalledWith("run_1", expect.anything());
    const body = await res.json();
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0]).toMatchObject({
      tool: "acs_query",
      args: { sql: "select 1" },
      ok: null,
    });
  });

  it("refuses an unauthenticated caller", async () => {
    requireAuthMock.mockResolvedValue({ authenticated: false });
    const res = await GET(request, params);
    expect(res.status).toBe(401);
    expect(runsGetMock).not.toHaveBeenCalled();
  });

  it("answers 404 for a run the harness does not show this tenant", async () => {
    runsGetMock.mockRejectedValue(
      new MiotHarnessApiError("forbidden", "run_1", "forbidden", 403)
    );
    const res = await GET(request, params);
    expect(res.status).toBe(404);
  });
});

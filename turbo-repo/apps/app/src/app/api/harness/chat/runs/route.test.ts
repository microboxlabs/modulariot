import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const runsListMock = vi.fn();

vi.mock("../../../utils/alfresco-crud-client", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

vi.mock("../../../utils/tenant-scope", () => ({
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
    runs: { list: (...args: unknown[]) => runsListMock(...args) },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./route";

describe("GET /api/harness/chat/runs", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    runsListMock.mockReset();
    requireAuthMock.mockResolvedValue({
      authenticated: true,
      session: { user: { email: "ana@example.com", rawJWT: "jwt" } },
    });
  });

  it("returns the harness list, passing the filters through", async () => {
    runsListMock.mockResolvedValue([{ run_id: "r1", status: "running" }]);
    const res = await GET(
      new Request(
        "http://app.test/api/harness/chat/runs?limit=500&status=running&conversation_id=t1"
      )
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ run_id: "r1", status: "running" }]);
    expect(runsListMock.mock.calls[0][0]).toEqual({
      conversation_id: "t1",
      status: "running",
      limit: 100,
    });
  });

  it("answers 401 without a session", async () => {
    requireAuthMock.mockResolvedValue({ authenticated: false });
    const res = await GET(new Request("http://app.test/api/harness/chat/runs"));
    expect(res.status).toBe(401);
    expect(runsListMock).not.toHaveBeenCalled();
  });

  it("answers 502 when the harness fails", async () => {
    runsListMock.mockRejectedValue(new Error("down"));
    const res = await GET(new Request("http://app.test/api/harness/chat/runs"));
    expect(res.status).toBe(502);
  });
});

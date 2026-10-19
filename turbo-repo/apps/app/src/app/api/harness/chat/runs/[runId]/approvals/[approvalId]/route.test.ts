import { beforeEach, describe, expect, it, vi } from "vitest";
import { MiotHarnessApiError } from "@microboxlabs/miot-harness-client";

const requireAuthMock = vi.fn();
const resolveApprovalMock = vi.fn();
const clientConfigs: unknown[] = [];

vi.mock("../../../../../../utils/alfresco-crud-client", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

vi.mock("../../../../../../utils/tenant-scope", () => ({
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
  createMiotHarnessClient: (config: unknown) => {
    clientConfigs.push(config);
    return {
      runs: {
        resolveApproval: (...args: unknown[]) => resolveApprovalMock(...args),
      },
    };
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

const params = {
  params: Promise.resolve({ runId: "run_1", approvalId: "aid_1" }),
};

function post(body: unknown): Request {
  return new Request(
    "http://app.test/api/harness/chat/runs/run_1/approvals/aid_1",
    { method: "POST", body: JSON.stringify(body) }
  );
}

describe("POST /api/harness/chat/runs/[runId]/approvals/[approvalId]", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    resolveApprovalMock.mockReset();
    clientConfigs.length = 0;
    requireAuthMock.mockResolvedValue({
      authenticated: true,
      session: { user: { rawJWT: "jwt", email: "user@example.com" } },
    });
  });

  it("forwards the decision to the harness as the user", async () => {
    resolveApprovalMock.mockResolvedValue(undefined);

    const res = await POST(
      post({ decision: "deny", comment: "  wrong title " }),
      params
    );

    expect(res.status).toBe(204);
    expect(resolveApprovalMock).toHaveBeenCalledWith(
      "run_1",
      "aid_1",
      { decision: "deny", comment: "wrong title" },
      expect.anything()
    );
    expect(clientConfigs[0]).toMatchObject({
      baseUrl: "http://modulith.test/api/v1/orgs/acme/harness",
      token: "jwt",
    });
  });

  it("drops a comment on an approval", async () => {
    resolveApprovalMock.mockResolvedValue(undefined);
    await POST(post({ decision: "approve", comment: "ok" }), params);
    expect(resolveApprovalMock.mock.calls[0]?.[2]).toEqual({
      decision: "approve",
    });
  });

  it("refuses a caller without a session", async () => {
    requireAuthMock.mockResolvedValue({ authenticated: false });
    const res = await POST(post({ decision: "approve" }), params);
    expect(res.status).toBe(401);
    expect(resolveApprovalMock).not.toHaveBeenCalled();
  });

  it("refuses anything but approve or deny", async () => {
    const res = await POST(post({ decision: "maybe" }), params);
    expect(res.status).toBe(400);
    expect(resolveApprovalMock).not.toHaveBeenCalled();
  });

  it("reports an approval that is no longer pending", async () => {
    resolveApprovalMock.mockRejectedValue(
      new MiotHarnessApiError("http_404", undefined, "", 404)
    );
    const res = await POST(post({ decision: "approve" }), params);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_pending" });
  });
});

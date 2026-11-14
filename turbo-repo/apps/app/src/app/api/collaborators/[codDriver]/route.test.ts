import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveTenantScopeMock = vi.fn();
const fetchDetailMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: (...args: unknown[]) => resolveTenantScopeMock(...args),
}));
vi.mock("@/app/api/utils/pgrest-client", () => ({
  fetchDriverDetailByCodDriver: (...args: unknown[]) =>
    fetchDetailMock(...args),
  driverDetailResponseToDto: (resp: { department: string }) => ({
    collaborator: { id: "1", department: resp.department },
    detailData: {
      collaboratorId: "1",
      scores: [],
      monthlyEvolution: [],
      behaviorEvents: [],
    },
  }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ALLOWED_TAX_ID = "11111111-1";
const OTHER_TAX_ID = "22222222-2";
const CACHE_TTL_MS = 30_000;
const STALE_TTL_MS = 5 * 60_000;
const T0 = 1_700_000_000_000;

function scopeFor(
  effectiveTaxIds: string[],
  { userId = "user-a", orgSlug = "org-a" } = {}
) {
  return {
    resolved: true,
    session: { user: { id: userId } },
    scope: {
      activeOrg: { id: 1, slug: orgSlug, modules: [] },
      availableOrgs: [],
      effectiveTaxIds,
    },
  };
}

function providerReturns(department: string) {
  fetchDetailMock.mockResolvedValue({ department });
}

let now = T0;
let GET: typeof import("./route").GET;

async function callGet(codDriver = "D-1") {
  const res = await GET(
    new Request(`http://localhost/api/collaborators/${codDriver}`),
    {
      params: Promise.resolve({ codDriver }),
    }
  );
  return {
    status: res.status,
    cacheStatus: res.headers.get("X-Cache-Status"),
    body: await res.json(),
  };
}

describe("GET /api/collaborators/[codDriver]", () => {
  beforeEach(async () => {
    vi.resetModules();
    resolveTenantScopeMock.mockReset();
    fetchDetailMock.mockReset();
    now = T0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.stubEnv("MIOT_COLLABORATORS_SOURCE", "pgrest");
    ({ GET } = await import("./route"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("scope guard on cached responses", () => {
    it("returns 403 on two consecutive requests for an out-of-scope driver", async () => {
      resolveTenantScopeMock.mockResolvedValue(scopeFor([ALLOWED_TAX_ID]));
      providerReturns(OTHER_TAX_ID);

      const first = await callGet();
      now += 1_000;
      const second = await callGet();

      expect(first.status).toBe(403);
      expect(second.status).toBe(403);
      expect(second.body).toEqual({ error: "Forbidden" });
    });

    it("keeps HIT for an in-scope driver without calling the provider again", async () => {
      resolveTenantScopeMock.mockResolvedValue(scopeFor([ALLOWED_TAX_ID]));
      providerReturns(ALLOWED_TAX_ID);

      const first = await callGet();
      now += 1_000;
      const second = await callGet();

      expect(first).toMatchObject({ status: 200, cacheStatus: "MISS" });
      expect(second).toMatchObject({ status: 200, cacheStatus: "HIT" });
      expect(second.body.collaborator.department).toBe(ALLOWED_TAX_ID);
      expect(fetchDetailMock).toHaveBeenCalledTimes(1);
    });

    it("re-checks the current scope on HIT when the scope shrinks", async () => {
      resolveTenantScopeMock
        .mockResolvedValueOnce(scopeFor([ALLOWED_TAX_ID, OTHER_TAX_ID]))
        .mockResolvedValueOnce(scopeFor([ALLOWED_TAX_ID]));
      providerReturns(OTHER_TAX_ID);

      const first = await callGet();
      now += 1_000;
      const second = await callGet();

      expect(first).toMatchObject({ status: 200, cacheStatus: "MISS" });
      expect(second.status).toBe(403);
    });

    it("does not serve an out-of-scope entry as STALE", async () => {
      resolveTenantScopeMock.mockResolvedValue(scopeFor([ALLOWED_TAX_ID]));
      providerReturns(OTHER_TAX_ID);

      await callGet();
      now += CACHE_TTL_MS + 1_000;
      const stale = await callGet();

      expect(stale.status).toBe(403);
    });

    it("re-checks the current scope on STALE when the scope shrinks", async () => {
      resolveTenantScopeMock
        .mockResolvedValueOnce(scopeFor([ALLOWED_TAX_ID, OTHER_TAX_ID]))
        .mockResolvedValue(scopeFor([ALLOWED_TAX_ID]));
      providerReturns(OTHER_TAX_ID);

      await callGet();
      now += CACHE_TTL_MS + 1_000;
      const stale = await callGet();

      expect(stale.status).toBe(403);
    });

    it("does not release an out-of-scope entry when the provider fails", async () => {
      resolveTenantScopeMock.mockResolvedValue(scopeFor([ALLOWED_TAX_ID]));
      providerReturns(OTHER_TAX_ID);
      await callGet();

      fetchDetailMock.mockRejectedValue(new Error("upstream down"));
      now += CACHE_TTL_MS + 1_000;
      const duringStaleWindow = await callGet();
      now += STALE_TTL_MS;
      const afterStaleWindow = await callGet();

      expect(duringStaleWindow.status).toBe(403);
      expect(afterStaleWindow.status).toBe(500);
      expect(afterStaleWindow.body).toEqual({
        error: "Failed to fetch collaborator detail",
      });
    });

    it("keeps the existing policy for an empty department", async () => {
      resolveTenantScopeMock.mockResolvedValue(scopeFor([ALLOWED_TAX_ID]));
      providerReturns("");

      const first = await callGet();
      const second = await callGet();

      expect(first).toMatchObject({ status: 200, cacheStatus: "MISS" });
      expect(second).toMatchObject({ status: 200, cacheStatus: "HIT" });
    });
  });

  describe("cache isolation and deduplication", () => {
    it("does not share entries across users or organizations", async () => {
      providerReturns(ALLOWED_TAX_ID);
      resolveTenantScopeMock
        .mockResolvedValueOnce(scopeFor([ALLOWED_TAX_ID]))
        .mockResolvedValueOnce(scopeFor([ALLOWED_TAX_ID], { userId: "user-b" }))
        .mockResolvedValueOnce(
          scopeFor([ALLOWED_TAX_ID], { orgSlug: "org-b" })
        );

      const userA = await callGet();
      const userB = await callGet();
      const otherOrg = await callGet();

      expect(userA.cacheStatus).toBe("MISS");
      expect(userB.cacheStatus).toBe("MISS");
      expect(otherOrg.cacheStatus).toBe("MISS");
      expect(fetchDetailMock).toHaveBeenCalledTimes(3);
    });

    it("shares one provider call between concurrent requests but authorizes each one", async () => {
      let resolveProvider: (value: { department: string }) => void = () => {};
      fetchDetailMock.mockReturnValue(
        new Promise((resolve) => {
          resolveProvider = resolve;
        })
      );
      resolveTenantScopeMock
        .mockResolvedValueOnce(scopeFor([ALLOWED_TAX_ID, OTHER_TAX_ID]))
        .mockResolvedValueOnce(scopeFor([ALLOWED_TAX_ID]));

      const allowed = callGet();
      const denied = callGet();
      await vi.waitFor(() => expect(fetchDetailMock).toHaveBeenCalled());
      resolveProvider({ department: OTHER_TAX_ID });

      expect(await allowed).toMatchObject({ status: 200, cacheStatus: "MISS" });
      expect((await denied).status).toBe(403);
      expect(fetchDetailMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("error responses", () => {
    it("returns 404 when the provider has no such driver and does not cache it", async () => {
      resolveTenantScopeMock.mockResolvedValue(scopeFor([ALLOWED_TAX_ID]));
      fetchDetailMock.mockResolvedValue(null);

      const first = await callGet();
      const second = await callGet();

      expect(first.status).toBe(404);
      expect(second.status).toBe(404);
      expect(fetchDetailMock).toHaveBeenCalledTimes(2);
    });

    it("returns 501 when the pgrest source is disabled", async () => {
      vi.stubEnv("MIOT_COLLABORATORS_SOURCE", "");
      resolveTenantScopeMock.mockResolvedValue(scopeFor([ALLOWED_TAX_ID]));

      const res = await callGet();

      expect(res.status).toBe(501);
      expect(fetchDetailMock).not.toHaveBeenCalled();
    });

    it("returns 400 for a blank codDriver", async () => {
      resolveTenantScopeMock.mockResolvedValue(scopeFor([ALLOWED_TAX_ID]));

      const res = await callGet("%20");

      expect(res.status).toBe(400);
    });
  });
});

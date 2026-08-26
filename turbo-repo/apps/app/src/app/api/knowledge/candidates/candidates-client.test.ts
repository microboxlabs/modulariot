import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Candidate,
  createCandidate,
  listCandidates,
  reviewCandidate,
  writeHarnessCard,
} from "./candidates-client";

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "c1",
    connection: "acs",
    term: "entregas",
    kind: "stage",
    scope: "tenant",
    confidence: 0.9,
    body: "solo confirmDelivery",
    provenance: { run_ids: ["r1"] },
    status: "approved",
    createdBy: "u1",
    reviewedBy: "rev@x",
    ...overrides,
  };
}

describe("candidates-client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("MIOT_MODULITH_URL", "http://modulith:8180");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lists pending candidates from the org-scoped modulith endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([candidate()]), { status: 200 }),
    );
    const result = await listCandidates({ orgSlug: "mintral", token: "jwt" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://modulith:8180/api/v1/orgs/mintral/knowledge/candidates?status=pending&limit=100",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
    expect(result).toHaveLength(1);
  });

  it("creates a candidate with a POST body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(candidate({ status: "pending" })), { status: 201 }),
    );
    await createCandidate({
      orgSlug: "o",
      token: "t",
      body: { connection: "acs", term: "entregas", body: "def" },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://modulith:8180/api/v1/orgs/o/knowledge/candidates");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).term).toBe("entregas");
  });

  it("maps a 404 review to null (unknown or already reviewed)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const res = await reviewCandidate({
      orgSlug: "o",
      token: "t",
      id: "gone",
      decision: "approve",
    });
    expect(res).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://modulith:8180/api/v1/orgs/o/knowledge/candidates/gone/approve",
    );
  });

  it("writes the approved card through the harness proxy using server fields", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }));
    await writeHarnessCard({
      orgSlug: "mintral",
      token: "jwt",
      candidate: candidate(),
      today: "2026-07-09",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://modulith:8180/api/v1/orgs/mintral/harness/connections/acs/knowledge",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      term: "entregas",
      body: "solo confirmDelivery",
      scope: "tenant",
      kind: "stage",
      confidence: 0.9,
      approved_by: "rev@x",
      provenance: { run_ids: ["r1"] },
      last_confirmed: "2026-07-09",
    });
  });

  it("throws when the harness card write is rejected (approval already durable)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }));
    await expect(
      writeHarnessCard({
        orgSlug: "o",
        token: "t",
        candidate: candidate(),
        today: "2026-07-09",
      }),
    ).rejects.toThrow(/card write failed/);
  });
});

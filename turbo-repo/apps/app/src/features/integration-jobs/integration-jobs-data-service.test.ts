import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJobs, fetchJobsCount } from "./integration-jobs-data-service";

/**
 * The console's filters and its pager are only real if they reach the backend:
 * a parameter dropped here silently degrades to "sift the rows already loaded",
 * which is what the paginated console exists to stop doing.
 */
function mockFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof mockFetch>): URL {
  return new URL(fetchMock.mock.calls[0][0] as string, "https://console.test");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("integration-jobs data service", () => {
  it("sends every filter and the page window to the list endpoint", async () => {
    const fetchMock = mockFetch([]);

    await fetchJobs("acme", {
      state: "FAILED",
      jobType: "calendar_sync",
      chainKey: "booking-7",
      executor: "modulith",
      search: "VJ-26-8710",
      limit: 50,
      offset: 100,
    });

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/app/api/admin/orgs/acme/integrations/jobs");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      state: "FAILED",
      jobType: "calendar_sync",
      chainKey: "booking-7",
      executor: "modulith",
      search: "VJ-26-8710",
      limit: "50",
      offset: "100",
    });
  });

  it("counts with the same filters but no window, so the total survives paging", async () => {
    const fetchMock = mockFetch({ total: 4648 });

    const total = await fetchJobsCount("acme", {
      state: "FAILED",
      search: "calendar",
      limit: 50,
      offset: 100,
    });

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/app/api/admin/orgs/acme/integrations/jobs/count");
    expect(Object.fromEntries(url.searchParams)).toEqual({ state: "FAILED", search: "calendar" });
    expect(total).toBe(4648);
  });

  it("reads a count response with no total as zero", async () => {
    mockFetch({});

    await expect(fetchJobsCount("acme")).resolves.toBe(0);
  });
});

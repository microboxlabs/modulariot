import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canConfigureReviews, useReviewBindings } from "./use-review-bindings";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

const requestedUrls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([url]) => String(url));

describe("useReviewBindings", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("does not call the owner-only routes for an operator", async () => {
    const { result } = renderHook(
      () => useReviewBindings({ slug: "acme", role: "MEMBER" }),
      { wrapper }
    );

    // Give SWR the chance to fire if it were going to.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.canConfigure).toBe(false);
    expect(result.current.targets).toEqual([]);
  });

  it("loads bindings and dispatch targets for an organization owner", async () => {
    const { result } = renderHook(
      () => useReviewBindings({ slug: "acme", role: "OWNER" }),
      { wrapper }
    );

    await waitFor(() =>
      expect(requestedUrls(fetchMock)).toEqual(
        expect.arrayContaining([
          "/app/api/admin/orgs/acme/integrations/bindings",
          "/app/api/admin/orgs/acme/integrations/dispatch-targets",
        ])
      )
    );
    expect(result.current.canConfigure).toBe(true);
  });

  it("waits for the organization", async () => {
    renderHook(() => useReviewBindings(null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("canConfigureReviews", () => {
  it("follows the owner rule of the admin routes", () => {
    expect(canConfigureReviews({ slug: "acme", role: "OWNER" })).toBe(true);
    expect(canConfigureReviews({ slug: "acme", role: "MEMBER" })).toBe(false);
    expect(canConfigureReviews({ slug: "acme", role: "PLATFORM_OWNER" })).toBe(
      false
    );
    expect(canConfigureReviews(undefined)).toBe(false);
  });
});

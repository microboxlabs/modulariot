import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { SWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";
import { useOrgScopes } from "./use-org-scopes";

vi.mock("@/features/common/hooks/use-unsaved-navigation", () => ({
  confirmNavigation: () => true,
}));

function Wrapper({ children }: Readonly<PropsWithChildren>) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("blocks every consumer before the session switch and reopens them after a refused switch", async () => {
  let finish: ((response: Response) => void) | undefined;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      path.endsWith("active-org")
        ? pending
        : Promise.resolve(
            Response.json({
              activeOrg: { slug: "tenant-a" },
              availableOrgs: [],
            })
          )
    )
  );
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { result } = renderHook(
    () => ({ one: useOrgScopes(), two: useOrgScopes() }),
    { wrapper: Wrapper }
  );
  await waitFor(() =>
    expect(result.current.one.activeOrg?.slug).toBe("tenant-a")
  );
  let switched: Promise<boolean | Error>;
  act(() => {
    switched = result.current.one
      .switchOrg("tenant-b")
      .catch((error: Error) => error);
  });
  await waitFor(() => expect(result.current.two.isSwitching).toBe(true));
  await act(async () => {
    finish?.(Response.json({ error: "Refused" }, { status: 403 }));
    await switched;
  });
  expect(result.current.one.isSwitching).toBe(false);
  expect(result.current.two.isSwitching).toBe(false);
});

it.each([true, false])(
  "confirms the scope before reopening after a lost switch response (refresh succeeds: %s)",
  async (refreshed) => {
    let finish: ((response: Response) => void) | undefined;
    const confirmedScope = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (path.endsWith("active-org"))
          return Promise.reject(new Error("Lost response"));
        if (reads++ === 0)
          return Promise.resolve(
            Response.json({
              activeOrg: { slug: "tenant-a" },
              availableOrgs: [],
            })
          );
        return confirmedScope;
      })
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useOrgScopes(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(result.current.activeOrg?.slug).toBe("tenant-a")
    );
    let switched: Promise<boolean | Error>;
    act(() => {
      switched = result.current
        .switchOrg("tenant-b")
        .catch((error: Error) => error);
    });
    await waitFor(() => expect(reads).toBe(2));
    expect(result.current.isSwitching).toBe(true);
    await act(async () => {
      finish?.(
        refreshed
          ? Response.json({
              activeOrg: { slug: "tenant-b" },
              availableOrgs: [],
            })
          : Response.json({ error: "Unavailable" }, { status: 503 })
      );
      await switched;
    });
    expect(result.current.activeOrg?.slug).toBe(
      refreshed ? "tenant-b" : "tenant-a"
    );
    expect(result.current.isSwitching).toBe(!refreshed);
  }
);

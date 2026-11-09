import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchWebRtcToken,
  reconcileTeamsCalls,
  saveTelephony,
  useTelephony,
  useRingingWhatsAppCalls,
} from "./telephony-api";
import { parseTelephonySetup } from "./telephony-api.types";

const { request, mutate, scope } = vi.hoisted(() => ({
  request: vi.fn(),
  mutate: vi.fn(),
  scope: { slug: "tenant-a", switching: false },
}));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({
    useOrgScopes: () => ({
      activeOrg: { slug: scope.slug },
      isSwitching: scope.switching,
    }),
  })
);
vi.mock("./control-tower-api", () => ({
  CONTROL_TOWER_BASE: "/tower",
  controlTowerRequest: request,
}));
vi.mock("swr", async (original) => ({
  ...(await original<typeof import("swr")>()),
  mutate,
}));

function Wrapper({ children }: Readonly<PropsWithChildren>) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}
const line = {
  connectionId: "telnyx-1",
  provider: "TELNYX",
  name: "Central",
  ready: true,
  callerNumber: "+12025550101",
};
const setup = { preferred: null, active: line, lines: [line] };

beforeEach(() => {
  request.mockReset();
  mutate.mockReset();
  scope.slug = "tenant-a";
  scope.switching = false;
});

describe("telephony configuration API boundary", () => {
  it("loads a valid configuration with provider-controlled nullable fields", async () => {
    request.mockResolvedValue({ lines: [{ ...line, callerNumber: null }] });
    const { result } = renderHook(() => useTelephony(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.lines).toHaveLength(1));
    expect(result.current.data?.preferred).toBeNull();
    expect(result.current.data?.active).toBeNull();
    expect(result.current.data?.lines[0].callerNumber).toBeNull();
  });

  it.each([
    { lines: {} },
    { ...setup, active: { ...line, provider: "UNKNOWN" } },
    { ...setup, lines: [{ ...line, ready: "yes" }] },
  ])(
    "reports malformed configuration through SWR without exposing invalid data: %s",
    async (payload) => {
      request.mockResolvedValue(payload);
      const { result } = renderHook(() => useTelephony(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.data).toBeUndefined();
    }
  );

  it("does not replace cached configuration with a malformed save response", async () => {
    request.mockResolvedValue({ lines: {} });
    await expect(saveTelephony("TELNYX")).rejects.toThrow();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("validates the save response before updating the cache", async () => {
    request.mockResolvedValue(setup);
    await expect(saveTelephony(null, scope.slug)).resolves.toEqual(setup);
    expect(mutate).toHaveBeenCalledWith(
      ["/tower/telephony", scope.slug],
      setup,
      {
        revalidate: false,
      }
    );
    expect(() => parseTelephonySetup(null)).toThrow();
  });
  it.each([true, false])("preserves the managed-line flag %s", (managed) => {
    const shared = { ...line, managed };
    const result = parseTelephonySetup({
      ...setup,
      active: shared,
      lines: [shared],
    });
    expect(result.active?.managed).toBe(managed);
    expect(result.lines[0].managed).toBe(managed);
  });

  it("validates the operator token before giving it to the calling SDK", async () => {
    const response = {
      token: "synthetic-token",
      callerNumber: "+12025550101",
      expiresAt: "2026-11-05T10:00:00Z",
      callRef: "managed-admission-1",
    };
    request.mockResolvedValue(response);
    await expect(fetchWebRtcToken()).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith("/tower/telephony/webrtc-token", {
      method: "POST",
      body: {},
    });
  });

  it.each([
    null,
    {},
    {
      token: "",
      callerNumber: "+12025550101",
      expiresAt: "2026-11-05T10:00:00Z",
    },
    {
      token: "synthetic-token",
      callerNumber: "not-a-number",
      expiresAt: "2026-11-05T10:00:00Z",
    },
    {
      token: "synthetic-token",
      callerNumber: "+12025550101",
      expiresAt: "invalid-date",
    },
  ])("rejects a malformed operator token response: %s", async (payload) => {
    request.mockResolvedValue(payload);
    await expect(fetchWebRtcToken()).rejects.toThrow();
  });
});

describe("incoming calls", () => {
  const incoming = {
    id: "in-a",
    callerNumber: "+12025550101",
    since: "2026-11-09T10:00:00Z",
  };

  it("recovers polling after a transient error", async () => {
    request
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValue([incoming]);
    const { result } = renderHook(() => useRingingWhatsAppCalls(true, 10), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data?.[0].id).toBe("in-a"));
    expect(request.mock.calls.length).toBeGreaterThan(1);
  });

  it("isolates setup and callers across organization changes and hides data during a switch", async () => {
    request.mockImplementation(async (path: string) =>
      path.endsWith("/telephony")
        ? { ...setup, whatsAppCalling: scope.slug === "tenant-a" }
        : [{ ...incoming, id: scope.slug }]
    );
    const { result, rerender } = renderHook(
      () => ({
        setup: useTelephony(),
        calls: useRingingWhatsAppCalls(true),
      }),
      { wrapper: Wrapper }
    );
    await waitFor(() =>
      expect(result.current.calls.data?.[0].id).toBe("tenant-a")
    );
    expect(result.current.setup.data?.whatsAppCalling).toBe(true);
    scope.switching = true;
    rerender();
    expect(result.current.calls.data).toBeUndefined();
    expect(result.current.setup.data).toBeUndefined();
    scope.slug = "tenant-b";
    scope.switching = false;
    rerender();
    expect(result.current.calls.data).toBeUndefined();
    await waitFor(() =>
      expect(result.current.calls.data?.[0].id).toBe("tenant-b")
    );
    expect(result.current.setup.data?.whatsAppCalling).toBe(false);
  });
});

describe("Teams reconciliation API boundary", () => {
  it("parses the complete reconciliation result", async () => {
    const response = { checked: 3, recorded: 1, pending: 2 };
    request.mockResolvedValue(response);
    await expect(reconcileTeamsCalls()).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith("/tower/telephony/reconcile", {
      method: "POST",
    });
  });

  it.each([
    null,
    {},
    { checked: -1, recorded: 0, pending: 0 },
    { checked: 1, recorded: "1", pending: 0 },
    { checked: 1.5, recorded: 1, pending: 0 },
  ])("rejects malformed reconciliation counts: %s", async (payload) => {
    request.mockResolvedValue(payload);
    await expect(reconcileTeamsCalls()).rejects.toThrow();
  });
});

import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveTelephony, useTelephony } from "./telephony-api";
import { parseTelephonySetup } from "./telephony-api.types";

const { request, mutate } = vi.hoisted(() => ({
  request: vi.fn(),
  mutate: vi.fn(),
}));
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

describe("telephony configuration API boundary", () => {
  beforeEach(() => {
    request.mockReset();
    mutate.mockReset();
  });

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
    await expect(saveTelephony(null)).resolves.toEqual(setup);
    expect(mutate).toHaveBeenCalledWith("/tower/telephony", setup, {
      revalidate: false,
    });
    expect(() => parseTelephonySetup(null)).toThrow();
  });
});

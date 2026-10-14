import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const CONFIG = { SYMPTOMS_PAST_FORMS: "true" };

describe("RuntimeConfigProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries after a failed fetch and then renders the gated children", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ ok: true, json: async () => CONFIG });
    vi.stubGlobal("fetch", fetchMock);
    const { RuntimeConfigProvider, RuntimeConfigReady, getRuntimeConfig } =
      await import("./runtime-config-context");

    render(
      <RuntimeConfigProvider>
        <RuntimeConfigReady>
          <p>ready</p>
        </RuntimeConfigReady>
      </RuntimeConfigProvider>
    );

    await act(async () => {});
    expect(screen.queryByText("ready")).toBeNull();
    expect(getRuntimeConfig()).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("ready")).toBeTruthy();
    expect(getRuntimeConfig()).toEqual(CONFIG);
  });
});

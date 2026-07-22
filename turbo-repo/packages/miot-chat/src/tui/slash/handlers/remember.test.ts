import { describe, it, expect, vi } from "vitest";
import { rememberCommand } from "./remember.js";
import type { SlashContext } from "../registry.js";

function ctx(recordEpisode?: unknown): SlashContext {
  return { recordEpisode, now: () => "T", uuid: () => "id-1" } as SlashContext;
}

describe("rememberCommand", () => {
  it("rejects an empty fact", async () => {
    const res = await rememberCommand.handle([], ctx(vi.fn()));
    expect(res.error).toMatch(/usage/);
  });

  it("errors when no recorder is bound", async () => {
    const res = await rememberCommand.handle(["entregas", "=", "x"], ctx(undefined));
    expect(res.error).toMatch(/recorder/);
  });

  it("records a cli 'remember' episode and confirms in the transcript", async () => {
    const rec = vi.fn();
    const res = await rememberCommand.handle(
      ["entregas", "solo", "confirmDelivery"],
      ctx(rec),
    );
    expect(rec).toHaveBeenCalledWith({
      surface: "cli",
      signal: "remember",
      payload: { fact: "entregas solo confirmDelivery" },
    });
    expect(res.output?.kind).toBe("system");
    if (res.output?.kind === "system") {
      expect(res.output.text).toContain("entregas solo confirmDelivery");
    }
  });
});

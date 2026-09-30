import { HttpAgent, type RunAgentInput } from "@ag-ui/client";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HarnessRunAgent } from "../harness-run-agent";
import { readRunEffort, setRunEffort, useRunEffort } from "./use-run-effort";

describe("run effort", () => {
  beforeEach(() => {
    localStorage.clear();
    setRunEffort(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores the choice and ignores unknown stored values", () => {
    setRunEffort("max");
    expect(localStorage.getItem("miot.harnessChat.effort")).toBe("max");
    expect(readRunEffort()).toBe("max");

    localStorage.setItem("miot.harnessChat.effort", "extreme");
    expect(readRunEffort()).toBeNull();
  });

  it("updates every picker when one of them changes", () => {
    const first = renderHook(() => useRunEffort());
    const second = renderHook(() => useRunEffort());

    act(() => first.result.current[1]("low"));

    expect(first.result.current[0]).toBe("low");
    expect(second.result.current[0]).toBe("low");
  });

  it("sends the stored effort with a run started before any picker mounted", () => {
    localStorage.setItem("miot.harnessChat.effort", "high");
    const run = vi
      .spyOn(HttpAgent.prototype, "run")
      .mockReturnValue(undefined as unknown as ReturnType<HttpAgent["run"]>);
    const agent = new HarnessRunAgent({ url: "http://localhost/stream" });

    const input: RunAgentInput = {
      threadId: "t1",
      runId: "r1",
      state: null,
      messages: [],
      tools: [],
      context: [],
      forwardedProps: {},
    };
    agent.run(input);

    expect(run.mock.calls[0][0].state).toEqual({ harnessEffort: "high" });
  });
});

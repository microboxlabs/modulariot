import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleSpec } from "./conversations-types";
import { newRuleSpec } from "./rule-model";

const api = vi.hoisted(() => ({
  useConversationRule: vi.fn(),
  saveRuleDraft: vi.fn(),
  publishRule: vi.fn(),
  refreshRules: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import { useRuleDraft } from "./use-rule-draft";

const spec = (when: string): RuleSpec =>
  newRuleSpec("symptom.case.opened", when);

function deferred() {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useRuleDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.saveRuleDraft.mockReset();
    api.publishRule.mockReset();
    api.useConversationRule.mockReturnValue({
      data: {
        rule: { id: "r1" },
        draft: null,
        current: { spec: spec("true") },
      },
      error: undefined,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("saves the edits one at a time, in order", async () => {
    const first = deferred();
    const second = deferred();
    api.saveRuleDraft
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useRuleDraft("r1"));

    act(() => result.current.update(spec("a")));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    act(() => result.current.update(spec("b")));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(api.saveRuleDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve({ draft: { spec: spec("a") }, findings: [] });
    });
    expect(api.saveRuleDraft).toHaveBeenCalledTimes(2);
    expect(api.saveRuleDraft.mock.calls[1][1].trigger.when).toBe("b");

    await act(async () => {
      second.resolve({ draft: { spec: spec("b") }, findings: [] });
    });
    expect(result.current.saving).toBe(false);
  });

  it("keeps a failed edit, refuses to publish it, and saves it on the next flush", async () => {
    api.saveRuleDraft.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useRuleDraft("r1"));

    act(() => result.current.update(spec("a")));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.saveError).toBe("offline");

    api.saveRuleDraft.mockRejectedValueOnce(new Error("still offline"));
    await act(async () => {
      await expect(result.current.publish("why")).rejects.toThrow(
        "still offline"
      );
    });
    expect(api.publishRule).not.toHaveBeenCalled();

    api.saveRuleDraft.mockResolvedValueOnce({
      draft: { spec: spec("a") },
      findings: [],
    });
    await act(async () => {
      await result.current.flush();
    });
    expect(api.saveRuleDraft).toHaveBeenCalledTimes(3);
    expect(result.current.saveError).toBeNull();
  });
});

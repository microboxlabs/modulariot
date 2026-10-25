import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleSpec } from "./conversations-types";

const api = vi.hoisted(() => ({
  useConversationRule: vi.fn(),
  discardRuleDraft: vi.fn(),
  publishRule: vi.fn(),
  refreshRules: vi.fn(),
  saveRuleDraft: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import { useRuleDraft } from "./use-rule-draft";

const published: RuleSpec = {
  trigger: { event: "trip.opened", when: null },
  audience: [],
  steps: [],
};
const edited: RuleSpec = { ...published, family: "operations" };
const ignored: RuleSpec = { ...published, family: "support" };

describe("useRuleDraft discard", () => {
  let completeDiscard: (() => void) | undefined;
  let failDiscard: ((error: Error) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    api.useConversationRule.mockReturnValue({
      data: {
        rule: { id: "r1" },
        current: { spec: published },
        draft: null,
      },
      mutate: vi
        .fn()
        .mockResolvedValue({ current: { spec: published }, draft: null }),
    });
    api.discardRuleDraft.mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          completeDiscard = resolve;
          failDiscard = reject;
        })
    );
    api.saveRuleDraft.mockResolvedValue({
      draft: { spec: edited },
      findings: [],
    });
    api.refreshRules.mockResolvedValue(undefined);
  });

  it("ignores edits until a successful discard finishes", async () => {
    const { result } = renderHook(() => useRuleDraft("r1"));
    await waitFor(() => expect(result.current.spec).not.toBeNull());
    act(() => result.current.update(edited));

    let discard!: Promise<void>;
    act(() => {
      discard = result.current.discard();
    });
    expect(result.current.discarding).toBe(true);
    act(() => result.current.update(ignored));
    expect(result.current.spec).toEqual(edited);

    await act(async () => {
      await Promise.resolve();
      completeDiscard?.();
      await discard;
    });

    expect(result.current.discarding).toBe(false);
    expect(result.current.spec).toEqual({ ...published, family: null });
    expect(api.saveRuleDraft).not.toHaveBeenCalled();
  });

  it("retries the pending edit when discard fails", async () => {
    const { result } = renderHook(() => useRuleDraft("r1"));
    await waitFor(() => expect(result.current.spec).not.toBeNull());
    act(() => result.current.update(edited));

    let discard!: Promise<void>;
    act(() => {
      discard = result.current.discard();
    });
    act(() => result.current.update(ignored));

    await act(async () => {
      await Promise.resolve();
      failDiscard?.(new Error("Discard failed"));
      await expect(discard).rejects.toThrow("Discard failed");
    });

    await waitFor(() =>
      expect(api.saveRuleDraft).toHaveBeenCalledWith("r1", edited)
    );
    expect(result.current.discarding).toBe(false);
    expect(result.current.spec).toEqual(edited);
  });

  it("keeps the published spec if reloading fails after a successful discard", async () => {
    const mutate = vi
      .fn()
      .mockResolvedValueOnce({ current: { spec: published }, draft: null })
      .mockRejectedValueOnce(new Error("Reload failed"));
    api.useConversationRule.mockReturnValue({
      data: { rule: { id: "r1" }, current: { spec: published }, draft: null },
      mutate,
    });
    const { result } = renderHook(() => useRuleDraft("r1"));
    await waitFor(() => expect(result.current.spec).not.toBeNull());
    act(() => result.current.update(edited));

    let discard!: Promise<void>;
    act(() => {
      discard = result.current.discard();
    });
    await act(async () => {
      await Promise.resolve();
      completeDiscard?.();
      await expect(discard).rejects.toThrow("Reload failed");
    });

    expect(result.current.spec).toEqual({ ...published, family: null });
    expect(result.current.discarding).toBe(false);
    expect(api.saveRuleDraft).not.toHaveBeenCalled();
  });
});

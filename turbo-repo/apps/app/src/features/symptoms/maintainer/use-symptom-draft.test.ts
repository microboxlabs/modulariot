import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SymptomDetail, SymptomSpec } from "./maintainer-api";

const api = vi.hoisted(() => ({
  useSymptomDefinition: vi.fn(),
  saveDraft: vi.fn(),
  validateSpec: vi.fn(),
  previewSpec: vi.fn(),
  refreshSymptoms: vi.fn(),
  discardDraft: vi.fn(),
  publishPlanKey: (id: string) => `plan/${id}`,
}));
vi.mock("./maintainer-api", () => api);
const swr = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("swr", () => swr);

import { useSymptomDraft } from "./use-symptom-draft";

const DRAFT = { activation: "a && b" } as SymptomSpec;
const DETAIL = { draft: { spec: DRAFT }, current: null } as SymptomDetail;

describe("useSymptomDraft planIsCurrent", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.useSymptomDefinition.mockReturnValue({
      data: DETAIL,
      error: undefined,
      mutate: vi.fn(),
    });
    api.saveDraft.mockResolvedValue(undefined);
    api.validateSpec.mockResolvedValue({ findings: [] });
    api.previewSpec.mockResolvedValue({ samples: [] });
    api.refreshSymptoms.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("is true for the loaded draft, false while an edit is unsaved, true once its plan reloads", async () => {
    let reloadPlan = () => {};
    swr.mutate.mockImplementation(
      () => new Promise<void>((resolve) => (reloadPlan = resolve))
    );
    const { result } = renderHook(() => useSymptomDraft("s1", true));
    await waitFor(() => expect(result.current.spec).toBe(DRAFT));
    expect(result.current.planIsCurrent).toBe(true);

    act(() => result.current.update({ activation: "b && a" } as SymptomSpec));
    expect(result.current.planIsCurrent).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(700));
    await waitFor(() => expect(swr.mutate).toHaveBeenCalledWith("plan/s1"));
    expect(result.current.planIsCurrent).toBe(false);

    await act(async () => reloadPlan());
    expect(result.current.planIsCurrent).toBe(true);
  });

  it("stays false when the save fails", async () => {
    api.saveDraft.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useSymptomDraft("s1", true));
    await waitFor(() => expect(result.current.spec).toBe(DRAFT));

    act(() => result.current.update({ activation: "a > 1" } as SymptomSpec));
    await act(() => vi.advanceTimersByTimeAsync(700));
    await waitFor(() => expect(result.current.saveError).toBe("down"));
    expect(result.current.planIsCurrent).toBe(false);
  });
});

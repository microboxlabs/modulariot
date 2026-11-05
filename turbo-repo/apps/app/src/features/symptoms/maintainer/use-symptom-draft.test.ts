import { useSyncExternalStore } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SymptomDetail,
  SymptomSpec,
  SymptomVersion,
} from "./maintainer-api";

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

const DRAFT = { activation: "a\n&& b" } as SymptomSpec;
const DETAIL = { draft: { spec: DRAFT }, current: null } as SymptomDetail;

describe("useSymptomDraft planIsCurrent", () => {
  beforeEach(() => {
    api.saveDraft.mockReset();
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

  it("shows a one-line activation one condition per line without saving it", async () => {
    api.useSymptomDefinition.mockReturnValue({
      data: { draft: null, current: { spec: { activation: "a && b" } } },
      error: undefined,
      mutate: vi.fn(),
    });
    const { result } = renderHook(() => useSymptomDraft("s1", true));
    await waitFor(() =>
      expect(result.current.spec?.activation).toBe("a\n&& b")
    );
    await act(() => vi.advanceTimersByTimeAsync(700));
    expect(api.saveDraft).not.toHaveBeenCalled();
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

describe("useSymptomDraft and a draft written elsewhere", () => {
  let detail: SymptomDetail;
  beforeEach(() => {
    detail = DETAIL;
    api.saveDraft.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.useSymptomDefinition.mockImplementation(() => ({
      data: detail,
      error: undefined,
      mutate: vi.fn(async () => detail),
    }));
    api.saveDraft.mockImplementation(
      async (_id: string, spec: SymptomSpec) => ({ spec })
    );
    api.validateSpec.mockResolvedValue({ findings: [] });
    api.previewSpec.mockResolvedValue({ samples: [] });
    api.refreshSymptoms.mockResolvedValue(undefined);
    swr.mutate.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  const harnessDraft = { activation: "c\n&& d" } as SymptomSpec;

  it("takes the new draft at once when nothing here is unsaved", async () => {
    const { result, rerender } = renderHook(() => useSymptomDraft("s1", true));
    await waitFor(() => expect(result.current.spec).toBe(DRAFT));
    detail = { ...DETAIL, draft: { spec: harnessDraft } } as SymptomDetail;
    rerender();
    await waitFor(() => expect(result.current.spec).toEqual(harnessDraft));
    expect(result.current.external).toBe(false);
  });

  it("does not take its own saved draft for one written elsewhere", async () => {
    const { result, rerender } = renderHook(() => useSymptomDraft("s1", true));
    await waitFor(() => expect(result.current.spec).toBe(DRAFT));
    const mine = { activation: "mine" } as SymptomSpec;
    act(() => result.current.update(mine));
    await act(() => vi.advanceTimersByTimeAsync(700));
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalled());
    detail = { ...DETAIL, draft: { spec: mine } } as SymptomDetail;
    rerender();
    expect(result.current.external).toBe(false);
    expect(result.current.spec).toBe(mine);
  });

  it("offers the new draft, keeping the edits on screen, when they are unsaved", async () => {
    const { result, rerender } = renderHook(() => useSymptomDraft("s1", true));
    await waitFor(() => expect(result.current.spec).toBe(DRAFT));
    const typing = { activation: "typing" } as SymptomSpec;
    act(() => result.current.update(typing));
    detail = { ...DETAIL, draft: { spec: harnessDraft } } as SymptomDetail;
    rerender();
    await waitFor(() => expect(result.current.external).toBe(true));
    expect(result.current.spec).toBe(typing);

    await act(() => result.current.resync());
    expect(result.current.external).toBe(false);
    expect(result.current.spec).toEqual(harnessDraft);
  });

  it("forgets the conflict when another symptom opens", async () => {
    const { result, rerender } = renderHook(
      ({ id }) => useSymptomDraft(id, true),
      { initialProps: { id: "s1" } }
    );
    await waitFor(() => expect(result.current.spec).toBe(DRAFT));
    act(() => result.current.update({ activation: "typing" } as SymptomSpec));
    detail = { ...DETAIL, draft: { spec: harnessDraft } } as SymptomDetail;
    rerender({ id: "s1" });
    await waitFor(() => expect(result.current.external).toBe(true));

    rerender({ id: "s2" });
    await waitFor(() => expect(result.current.external).toBe(false));
  });
});

describe("useSymptomDraft after a publish or a discard", () => {
  const V010 = {
    id: "v1",
    version: "0.1.0",
    status: "PUBLISHED",
    spec: { state: "TEST", activation: "a" },
  } as SymptomVersion;
  const DRAFT_ACTIVE = {
    id: "v2",
    version: null,
    status: "DRAFT",
    spec: { state: "ACTIVE", activation: "a" },
  } as SymptomVersion;
  let cached: SymptomDetail;
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  // As SWR's: a change rewrites the cache; a reload that is dropped resolves with what the cache holds.
  const mutate = vi.fn(async (change?: (d: SymptomDetail) => SymptomDetail) => {
    if (change) {
      cached = change(cached);
      listeners.forEach((l) => l());
    }
    return cached;
  });

  beforeEach(() => {
    cached = {
      definition: { state: "TEST", currentVersion: "0.1.0" },
      current: V010,
      draft: DRAFT_ACTIVE,
      versions: [V010],
    } as unknown as SymptomDetail;
    mutate.mockClear();
    api.useSymptomDefinition.mockImplementation(() => ({
      data: useSyncExternalStore(subscribe, () => cached),
      error: undefined,
      mutate,
    }));
    api.validateSpec.mockResolvedValue({ findings: [] });
    api.previewSpec.mockResolvedValue({ samples: [] });
    api.refreshSymptoms.mockResolvedValue(undefined);
    api.discardDraft.mockResolvedValue(undefined);
    swr.mutate.mockResolvedValue(undefined);
  });

  it("shows the published version and its state, with no draft, without waiting for a reload", async () => {
    const { result } = renderHook(() => useSymptomDraft("s1", true));
    await waitFor(() => expect(result.current.spec).toEqual(DRAFT_ACTIVE.spec));
    const v011 = {
      ...DRAFT_ACTIVE,
      version: "0.1.1",
      status: "PUBLISHED",
    } as SymptomVersion;

    await act(() => result.current.showPublished(v011));

    const detail = result.current.detail as SymptomDetail;
    expect(detail.definition.currentVersion).toBe("0.1.1");
    expect(detail.definition.state).toBe("ACTIVE");
    expect(detail.draft).toBeNull();
    expect(detail.current).toBe(v011);
    expect(detail.versions.map((v) => v.version)).toEqual(["0.1.1", "0.1.0"]);
    expect(result.current.spec).toEqual(v011.spec);
  });

  it("takes the family of the published version", async () => {
    cached = {
      ...cached,
      definition: { ...cached.definition, family: "speed" },
    } as SymptomDetail;
    const { result } = renderHook(() => useSymptomDraft("s1", true));
    await waitFor(() => expect(result.current.spec).toEqual(DRAFT_ACTIVE.spec));
    const v011 = {
      ...DRAFT_ACTIVE,
      version: "0.1.1",
      status: "PUBLISHED",
      spec: { ...DRAFT_ACTIVE.spec, family: "fatigue" },
    } as SymptomVersion;

    await act(() => result.current.showPublished(v011));

    expect(result.current.detail?.definition.family).toBe("fatigue");
  });

  it("drops the draft on discard and goes back to the version in force", async () => {
    const { result } = renderHook(() => useSymptomDraft("s1", true));
    await waitFor(() => expect(result.current.spec).toEqual(DRAFT_ACTIVE.spec));

    await act(() => result.current.discard());

    expect(api.discardDraft).toHaveBeenCalledWith("s1", expect.anything());
    expect(result.current.detail?.draft).toBeNull();
    expect(result.current.detail?.definition.currentVersion).toBe("0.1.0");
    expect(result.current.spec).toEqual(V010.spec);
  });
});

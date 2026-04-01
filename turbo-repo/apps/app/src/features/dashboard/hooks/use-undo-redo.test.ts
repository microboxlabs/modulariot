import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoRedo } from "./use-undo-redo";
import { makeDashboardStorage } from "../test-fixtures";

describe("useUndoRedo", () => {
  const stateA = makeDashboardStorage({ name: "State A" });
  const stateB = makeDashboardStorage({ name: "State B" });
  const stateC = makeDashboardStorage({ name: "State C" });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty undo/redo stacks", () => {
    const saveData = vi.fn();
    const { result } = renderHook(() => useUndoRedo(() => stateA, saveData));

    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(false);
  });

  it("pushes snapshot on saveDataWithHistory and supports undo", () => {
    const saveData = vi.fn();
    let current = stateA;
    const { result } = renderHook(() => useUndoRedo(() => current, saveData));

    // Mutate: A -> B
    act(() => {
      result.current.saveDataWithHistory(stateB);
    });
    current = stateB;
    expect(saveData).toHaveBeenLastCalledWith(stateB);
    expect(result.current.canUndo()).toBe(true);

    // Advance past batch window
    act(() => vi.advanceTimersByTime(600));

    // Undo: B -> A
    act(() => {
      result.current.undo();
    });
    current = stateA;
    expect(saveData).toHaveBeenLastCalledWith(stateA);
    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(true);
  });

  it("supports redo after undo", () => {
    const saveData = vi.fn();
    let current = stateA;
    const { result } = renderHook(() => useUndoRedo(() => current, saveData));

    // A -> B
    act(() => result.current.saveDataWithHistory(stateB));
    current = stateB;
    act(() => vi.advanceTimersByTime(600));

    // B -> C
    act(() => result.current.saveDataWithHistory(stateC));
    current = stateC;
    act(() => vi.advanceTimersByTime(600));

    // Undo to B
    act(() => result.current.undo());
    current = stateB;
    expect(saveData).toHaveBeenLastCalledWith(stateB);

    // Redo to C
    act(() => result.current.redo());
    current = stateC;
    expect(saveData).toHaveBeenLastCalledWith(stateC);
    expect(result.current.canRedo()).toBe(false);
  });

  it("clears redo stack on new mutation after undo", () => {
    const saveData = vi.fn();
    let current = stateA;
    const { result } = renderHook(() => useUndoRedo(() => current, saveData));

    act(() => result.current.saveDataWithHistory(stateB));
    current = stateB;
    act(() => vi.advanceTimersByTime(600));

    // Undo to A
    act(() => result.current.undo());
    current = stateA;
    expect(result.current.canRedo()).toBe(true);

    act(() => vi.advanceTimersByTime(600));

    // New mutation: A -> C (should clear redo)
    act(() => result.current.saveDataWithHistory(stateC));
    current = stateC;
    expect(result.current.canRedo()).toBe(false);
  });

  it("batches mutations within the 500ms window into a single undo entry", () => {
    const saveData = vi.fn();
    let current = stateA;
    const { result } = renderHook(() => useUndoRedo(() => current, saveData));

    // First mutation: A -> B (pushes snapshot A)
    act(() => result.current.saveDataWithHistory(stateB));
    current = stateB;

    // Second mutation within 500ms: B -> C (should NOT push another snapshot)
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.saveDataWithHistory(stateC));
    current = stateC;

    // Single undo should go from C back to A (skipping B)
    act(() => vi.advanceTimersByTime(600));
    act(() => result.current.undo());
    current = stateA;
    expect(saveData).toHaveBeenLastCalledWith(stateA);
    expect(result.current.canUndo()).toBe(false);

    // Redo should go from A back to C
    act(() => result.current.redo());
    current = stateC;
    expect(saveData).toHaveBeenLastCalledWith(stateC);
  });

  it("limits history to max 50 snapshots", () => {
    const saveData = vi.fn();
    let current = stateA;
    const { result } = renderHook(() => useUndoRedo(() => current, saveData));

    // Push 60 snapshots (each outside batch window)
    for (let i = 0; i < 60; i++) {
      act(() => vi.advanceTimersByTime(600));
      const state = makeDashboardStorage({ name: `State ${i}` });
      act(() => result.current.saveDataWithHistory(state));
      current = state;
    }

    // Should only be able to undo 50 times
    let undoCount = 0;
    while (result.current.canUndo()) {
      act(() => result.current.undo());
      undoCount++;
    }
    expect(undoCount).toBe(50);
  });

  it("clearHistory empties both stacks", () => {
    const saveData = vi.fn();
    let current = stateA;
    const { result } = renderHook(() => useUndoRedo(() => current, saveData));

    act(() => result.current.saveDataWithHistory(stateB));
    current = stateB;
    act(() => vi.advanceTimersByTime(600));
    act(() => result.current.undo());
    current = stateA;

    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(true);

    act(() => result.current.clearHistory());
    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(false);
  });

  it("ignores side-effect mutations after undo (preserves redo stack)", () => {
    const saveData = vi.fn();
    let current = stateA;
    const { result } = renderHook(() => useUndoRedo(() => current, saveData));

    // A -> B
    act(() => result.current.saveDataWithHistory(stateB));
    current = stateB;
    act(() => vi.advanceTimersByTime(600));

    // Undo: B -> A
    act(() => result.current.undo());
    current = stateA;
    expect(result.current.canRedo()).toBe(true);

    // Simulate onLayoutChange side-effect within 500ms of undo
    const layoutState = makeDashboardStorage({ name: "Layout adjustment" });
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.saveDataWithHistory(layoutState));
    current = layoutState;

    // Redo stack should NOT have been cleared by the side-effect
    expect(result.current.canRedo()).toBe(true);
  });

  it("ignores side-effect mutations after redo (preserves undo stack)", () => {
    const saveData = vi.fn();
    let current = stateA;
    const { result } = renderHook(() => useUndoRedo(() => current, saveData));

    // A -> B
    act(() => result.current.saveDataWithHistory(stateB));
    current = stateB;
    act(() => vi.advanceTimersByTime(600));

    // Undo: B -> A
    act(() => result.current.undo());
    current = stateA;

    // Redo: A -> B
    act(() => result.current.redo());
    current = stateB;
    expect(result.current.canUndo()).toBe(true);

    // Simulate side-effect within 500ms of redo
    const layoutState = makeDashboardStorage({ name: "Layout adjustment" });
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.saveDataWithHistory(layoutState));
    current = layoutState;

    // Undo stack should still work — undo the redo
    expect(result.current.canUndo()).toBe(true);
  });

  it("undo/redo are no-ops when stacks are empty", () => {
    const saveData = vi.fn();
    const { result } = renderHook(() => useUndoRedo(() => stateA, saveData));

    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(saveData).not.toHaveBeenCalled();
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DURACION_RESALTADO_MS,
  easeOutCubic,
  useResaltadoAnimado,
} from "./highlight-animation";

describe("useResaltadoAnimado", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
  });
  afterEach(() => vi.useRealTimers());

  it("animates in, then out keeping the place while it fades", () => {
    const { result, rerender } = renderHook(
      ({ id }) => useResaltadoAnimado(id),
      { initialProps: { id: null as string | null } }
    );
    expect(result.current).toEqual({ id: null, t: 0 });

    rerender({ id: "park" });
    act(() => vi.advanceTimersByTime(DURACION_RESALTADO_MS / 2));
    expect(result.current.id).toBe("park");
    expect(result.current.t).toBeGreaterThan(0);
    expect(result.current.t).toBeLessThan(1);
    act(() => vi.advanceTimersByTime(DURACION_RESALTADO_MS));
    expect(result.current).toEqual({ id: "park", t: 1 });

    rerender({ id: null });
    act(() => vi.advanceTimersByTime(DURACION_RESALTADO_MS / 2));
    expect(result.current.id).toBe("park");
    act(() => vi.advanceTimersByTime(DURACION_RESALTADO_MS));
    expect(result.current).toEqual({ id: null, t: 0 });
  });

  it("eases out", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

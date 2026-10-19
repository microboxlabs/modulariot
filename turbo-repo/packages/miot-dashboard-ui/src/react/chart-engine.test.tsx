// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChartEngineView } from "./chart-engine";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const makeEngine = () => ({
  update: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  hideTooltip: vi.fn(),
});
it("updates in place, observes resize and disposes on replacement/unmount", () => {
  let resize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(fn: () => void) {
        resize = fn;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const first = makeEngine(),
    second = makeEngine();
  const createFirst = vi.fn(() => first),
    createSecond = vi.fn(() => second);
  const view = render(
    <ChartEngineView
      createEngine={createFirst}
      option={{ value: 1 }}
      ariaLabel="Costs"
    />,
  );
  view.rerender(
    <ChartEngineView
      createEngine={createFirst}
      option={{ value: 2 }}
      ariaLabel="Costs"
    />,
  );
  expect(createFirst).toHaveBeenCalledOnce();
  expect(first.update).toHaveBeenLastCalledWith({ value: 2 });
  resize();
  expect(first.resize).toHaveBeenCalledOnce();
  expect(screen.getByText("Costs").className).toBe("miot-sr-only");
  fireEvent.pointerLeave(
    view.container.querySelector(".miot-chart-engine") as Element,
  );
  expect(first.hideTooltip).toHaveBeenCalledOnce();
  const oldResize = resize;
  view.rerender(
    <ChartEngineView
      createEngine={createSecond}
      option={{ value: 3 }}
      ariaLabel="Costs"
    />,
  );
  expect(first.dispose).toHaveBeenCalledOnce();
  oldResize();
  expect(first.resize).toHaveBeenCalledOnce();
  expect(second.update).toHaveBeenCalledExactlyOnceWith({ value: 3 });
  view.unmount();
  resize();
  expect(second.dispose).toHaveBeenCalledOnce();
  expect(second.resize).not.toHaveBeenCalled();
  expect(disconnect).toHaveBeenCalledTimes(2);
});
it("handles Strict Mode replay and cleans up fallback resize listeners", () => {
  vi.stubGlobal("ResizeObserver", undefined);
  const engines: ReturnType<typeof makeEngine>[] = [];
  const createEngine = () => {
    const engine = makeEngine();
    engines.push(engine);
    return engine;
  };
  const view = render(
    <StrictMode>
      <ChartEngineView
        createEngine={createEngine}
        option="ready"
        ariaLabel="Chart"
      />
    </StrictMode>,
  );
  expect(engines).toHaveLength(2);
  expect(engines[0]!.dispose).toHaveBeenCalledOnce();
  fireEvent(window, new Event("resize"));
  expect(engines[0]!.resize).not.toHaveBeenCalled();
  expect(engines[1]!.resize).toHaveBeenCalledOnce();
  view.unmount();
  fireEvent(window, new Event("resize"));
  expect(engines[1]!.dispose).toHaveBeenCalledOnce();
  expect(engines[1]!.resize).toHaveBeenCalledOnce();
});

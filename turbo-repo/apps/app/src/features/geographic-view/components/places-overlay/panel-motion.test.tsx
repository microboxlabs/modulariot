import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  EXPAND_MS,
  ExpandPanel,
  GrowPanel,
  PANEL_MOTION_MS,
  SlidePanel,
  STEP_SWAP_MS,
  StepSwap,
  useOutThenIn,
  usePanelOpen,
} from "./panel-motion";

describe("GrowPanel", () => {
  it("keeps the card mounted while it collapses, then removes it", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <GrowPanel show>
        <p>Panel</p>
      </GrowPanel>
    );

    expect(screen.getByText("Panel")).toBeInTheDocument();

    rerender(
      <GrowPanel show={false}>
        <p>Panel</p>
      </GrowPanel>
    );
    expect(screen.getByText("Panel")).toBeInTheDocument();
    expect(
      screen.getByText("Panel").closest("[data-panel-motion]")
    ).toHaveAttribute("data-panel-motion", "closed");

    act(() => {
      vi.advanceTimersByTime(PANEL_MOTION_MS);
    });
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

function OutThenInHost({ step }: { step: 0 | 1 }) {
  const { shown, visible } = useOutThenIn(step);
  return (
    <p data-visible={visible ? "in" : "out"}>
      {shown === 0 ? "Geocerca" : "Interiores"}
    </p>
  );
}

describe("useOutThenIn", () => {
  it("fades the current step out before swapping content", () => {
    vi.useFakeTimers();
    const { rerender } = render(<OutThenInHost step={0} />);

    expect(screen.getByText("Geocerca")).toHaveAttribute("data-visible", "in");

    rerender(<OutThenInHost step={1} />);
    expect(screen.getByText("Geocerca")).toHaveAttribute("data-visible", "out");

    act(() => {
      vi.advanceTimersByTime(STEP_SWAP_MS - 1);
    });
    expect(screen.getByText("Geocerca")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("Interiores")).toHaveAttribute(
      "data-visible",
      "out"
    );
    vi.useRealTimers();
  });
});

describe("StepSwap", () => {
  it("mounts only the active step and can hide it before the swap", () => {
    const { rerender } = render(
      <StepSwap step={0} first={<p>Geocerca</p>} second={<p>Interiores</p>} />
    );

    expect(screen.getByText("Geocerca")).toBeInTheDocument();
    expect(screen.queryByText("Interiores")).toBeNull();

    rerender(
      <StepSwap
        step={0}
        visible={false}
        first={<p>Geocerca</p>}
        second={<p>Interiores</p>}
      />
    );
    expect(
      screen.getByText("Geocerca").closest("[data-step-visible]")
    ).toHaveAttribute("data-step-visible", "out");

    rerender(
      <StepSwap
        step={1}
        visible={false}
        first={<p>Geocerca</p>}
        second={<p>Interiores</p>}
      />
    );
    expect(screen.queryByText("Geocerca")).toBeNull();
    expect(screen.getByText("Interiores")).toBeInTheDocument();
  });
});

describe("SlidePanel", () => {
  it("opens after the enter animation frames", async () => {
    render(
      <SlidePanel show>
        <p>Catalog</p>
      </SlidePanel>
    );

    expect(
      screen.getByText("Catalog").closest("[data-panel-motion]")
    ).toHaveAttribute("data-panel-motion", "closed");

    await act(async () => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
      );
    });

    expect(
      screen.getByText("Catalog").closest("[data-panel-motion]")
    ).toHaveAttribute("data-panel-motion", "open");
  });
});

describe("ExpandPanel", () => {
  it("unrolls by width only, keeping the content at full width", async () => {
    render(
      <ExpandPanel show width="w-110">
        <p>Lugares</p>
      </ExpandPanel>
    );
    const panel = screen.getByText("Lugares").closest("[data-panel-motion]");
    expect(panel).toHaveClass("w-0");
    expect(panel?.className).not.toContain("opacity");
    // the inner box is never squeezed and moves with the bar's left edge
    const contenido = screen.getByText("Lugares").parentElement;
    expect(contenido).toHaveClass("w-110", "left-0");

    await act(async () => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
      );
    });

    expect(panel).toHaveAttribute("data-panel-motion", "open");
    expect(panel).toHaveClass("w-110");
  });
});

const dosFrames = () =>
  act(async () => {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
    );
  });

describe("usePanelOpen", () => {
  it("opens on the same frame as the panel and closes at once", async () => {
    const { result, rerender } = renderHook(({ show }) => usePanelOpen(show), {
      initialProps: { show: false },
    });
    render(
      <ExpandPanel show width="w-110">
        <p>Barra</p>
      </ExpandPanel>
    );
    rerender({ show: true });
    expect(result.current).toBe(false);
    await dosFrames();
    // what moves beside the bar starts with it
    expect(result.current).toBe(true);
    expect(
      screen.getByText("Barra").closest("[data-panel-motion]")
    ).toHaveAttribute("data-panel-motion", "open");
    rerender({ show: false });
    expect(result.current).toBe(false);
  });
});

describe("ExpandPanel closing", () => {
  it("stays mounted until the whole fold has run", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { rerender } = render(
      <ExpandPanel show width="w-110">
        <p>Barra</p>
      </ExpandPanel>
    );
    rerender(
      <ExpandPanel show={false} width="w-110">
        <p>Barra</p>
      </ExpandPanel>
    );
    act(() => vi.advanceTimersByTime(EXPAND_MS - 1));
    expect(screen.getByText("Barra")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Barra")).toBeNull();
    vi.useRealTimers();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fitView,
  svgMarkupSize,
  ZoomableView,
  zoomAround,
} from "./zoomable-view";

vi.mock("../../context/harness-chat-i18n-context", () => ({
  useHarnessChatTr: () => (key: string) => key,
}));

// jsdom has no PointerEvent; without it the pointer id and button are lost.
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}
vi.stubGlobal("PointerEvent", globalThis.PointerEvent ?? TestPointerEvent);

describe("zoomAround", () => {
  it("keeps the point under the cursor in place", () => {
    const view = zoomAround({ scale: 1, x: 10, y: 20 }, 2, { x: 110, y: 70 });
    expect(view).toEqual({ scale: 2, x: -90, y: -30 });
    // Content point (100, 50) is drawn at the cursor before and after.
    expect(view.x + 100 * view.scale).toBe(110);
    expect(view.y + 50 * view.scale).toBe(70);
  });

  it("stops at the zoom limits", () => {
    expect(
      zoomAround({ scale: 4, x: 0, y: 0 }, 100, { x: 0, y: 0 }).scale
    ).toBe(8);
    expect(
      zoomAround({ scale: 0.1, x: 0, y: 0 }, 0.001, { x: 0, y: 0 }).scale
    ).toBe(0.05);
  });
});

describe("fitView", () => {
  it("shrinks a wide drawing to the box and centers it", () => {
    const view = fitView(
      { width: 1800, height: 600 },
      { width: 932, height: 632 }
    );
    expect(view).toEqual({ scale: 0.5, x: 16, y: 166 });
  });

  it("never enlarges a small drawing", () => {
    expect(
      fitView({ width: 100, height: 50 }, { width: 800, height: 600 })
    ).toEqual({
      scale: 1,
      x: 350,
      y: 275,
    });
  });
});

describe("svgMarkupSize", () => {
  it("reads the viewBox, else pixel width and height", () => {
    expect(
      svgMarkupSize(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 640"/>'
      )
    ).toEqual({ width: 1800, height: 640 });
    expect(
      svgMarkupSize(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120px"/>'
      )
    ).toEqual({ width: 300, height: 120 });
    expect(
      svgMarkupSize('<svg xmlns="http://www.w3.org/2000/svg" width="100%"/>')
    ).toBeNull();
  });
});

describe("ZoomableView", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
  });
  afterEach(() => vi.restoreAllMocks());

  const transform = () =>
    screen.getByTestId("zoomable-content").style.transform;

  function renderView() {
    return render(
      <ZoomableView size={{ width: 1600, height: 400 }}>
        <span>drawing</span>
      </ZoomableView>
    );
  }

  it("starts fitted and sized to the drawing", () => {
    renderView();
    const content = screen.getByTestId("zoomable-content");
    expect(content.style.width).toBe("1600px");
    expect(transform()).toBe("translate(16px, 104px) scale(0.23)");
    expect(screen.getByText("23%")).toBeTruthy();
  });

  it("zooms with the buttons, the keyboard, the wheel and a double-click", () => {
    renderView();
    const area = screen.getByTestId("zoomable-area");

    fireEvent.click(
      screen.getByLabelText("harnessChat.ui.showArtifact.actualSize")
    );
    expect(screen.getByText("100%")).toBeTruthy();

    fireEvent.click(
      screen.getByLabelText("harnessChat.ui.showArtifact.zoomIn")
    );
    expect(screen.getByText("125%")).toBeTruthy();

    fireEvent.keyDown(area, { key: "-" });
    expect(screen.getByText("100%")).toBeTruthy();

    fireEvent.wheel(area, { deltaY: -500, clientX: 0, clientY: 0 });
    expect(screen.getByText("272%")).toBeTruthy();

    fireEvent.keyDown(area, { key: "0" });
    expect(screen.getByText("23%")).toBeTruthy();

    fireEvent.doubleClick(area, { clientX: 0, clientY: 0 });
    expect(screen.getByText("46%")).toBeTruthy();
  });

  it("pans on drag", () => {
    renderView();
    const area = screen.getByTestId("zoomable-area");
    fireEvent.pointerDown(area, {
      pointerId: 1,
      button: 0,
      clientX: 50,
      clientY: 50,
    });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 80, clientY: 40 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 200, clientY: 200 });
    expect(transform()).toBe("translate(46px, 94px) scale(0.23)");
  });

  it("reads the size from the svg its children render", () => {
    render(
      <ZoomableView>
        <div>
          <svg viewBox="0 0 800 200" />
        </div>
      </ZoomableView>
    );
    expect(screen.getByTestId("zoomable-content").style.width).toBe("800px");
  });
});

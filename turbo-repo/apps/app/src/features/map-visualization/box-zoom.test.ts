import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { attachBoxZoom, getBoxZoomTarget, type BoxZoomMap } from "./box-zoom";

describe("getBoxZoomTarget", () => {
  const viewport = { width: 1000, height: 500, zoom: 5, maxZoom: 22 };

  it("centers on the box and zooms until the box fills the viewport", () => {
    const target = getBoxZoomTarget({
      ...viewport,
      start: { x: 100, y: 100 },
      end: { x: 600, y: 350 },
    });
    expect(target).toEqual({ center: { x: 350, y: 225 }, zoom: 6 });
  });

  it("fits the limiting side of the box", () => {
    // 250x50 box: width allows x4, height allows x10, so width wins (+2)
    const target = getBoxZoomTarget({
      ...viewport,
      start: { x: 0, y: 0 },
      end: { x: 250, y: 50 },
    });
    expect(target?.zoom).toBe(7);
  });

  it("gives the same result whichever way the box is dragged", () => {
    const forward = getBoxZoomTarget({
      ...viewport,
      start: { x: 100, y: 100 },
      end: { x: 600, y: 350 },
    });
    const backward = getBoxZoomTarget({
      ...viewport,
      start: { x: 600, y: 350 },
      end: { x: 100, y: 100 },
    });
    expect(backward).toEqual(forward);
  });

  it("clamps to the map's max zoom", () => {
    const target = getBoxZoomTarget({
      ...viewport,
      zoom: 21,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    });
    expect(target?.zoom).toBe(22);
  });

  it("never zooms out when the viewport can't be measured", () => {
    const target = getBoxZoomTarget({
      ...viewport,
      height: 0,
      start: { x: 100, y: 100 },
      end: { x: 600, y: 350 },
    });
    expect(target).toBeNull();
  });

  it("ignores boxes that are too thin", () => {
    const target = getBoxZoomTarget({
      ...viewport,
      start: { x: 0, y: 0 },
      end: { x: 300, y: 2 },
    });
    expect(target).toBeNull();
  });
});

describe("attachBoxZoom", () => {
  let mapElement: HTMLDivElement;
  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let easeTo: ReturnType<typeof vi.fn<BoxZoomMap["easeTo"]>>;
  let unproject: ReturnType<typeof vi.fn<BoxZoomMap["unproject"]>>;
  let detach: () => void;

  const mouse = (type: string, x: number, y: number, shiftKey = false) =>
    new MouseEvent(type, {
      clientX: x,
      clientY: y,
      button: 0,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });

  beforeEach(() => {
    // Mirrors mapbox-gl's DOM: a sized map element holding a canvas container
    // that has no height of its own (the canvas is absolutely positioned).
    mapElement = document.createElement("div");
    container = document.createElement("div");
    canvas = document.createElement("canvas");
    container.appendChild(canvas);
    mapElement.appendChild(container);
    document.body.appendChild(mapElement);
    Object.defineProperty(mapElement, "clientWidth", { value: 1000 });
    Object.defineProperty(mapElement, "clientHeight", { value: 500 });
    // Map sits at (10, 20) on the page
    container.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 1000, height: 0 }) as DOMRect;

    easeTo = vi.fn<BoxZoomMap["easeTo"]>();
    unproject = vi.fn<BoxZoomMap["unproject"]>(([x, y]) => ({
      lng: x,
      lat: y,
    }));
    detach = attachBoxZoom({
      getContainer: () => mapElement,
      getCanvasContainer: () => container,
      unproject,
      getZoom: () => 5,
      getMaxZoom: () => 22,
      easeTo,
    });
  });

  afterEach(() => {
    detach();
    mapElement.remove();
  });

  it("zooms to the box drawn with Shift + drag", () => {
    canvas.dispatchEvent(mouse("mousedown", 110, 120, true));
    globalThis.dispatchEvent(mouse("mousemove", 610, 370));
    globalThis.dispatchEvent(mouse("mouseup", 610, 370));

    expect(unproject).toHaveBeenCalledWith([350, 225]);
    expect(easeTo).toHaveBeenCalledWith({ center: [350, 225], zoom: 6 });
  });

  it("shows the box while dragging and removes it afterwards", () => {
    canvas.dispatchEvent(mouse("mousedown", 110, 120, true));
    globalThis.dispatchEvent(mouse("mousemove", 610, 370));
    expect(container.children).toHaveLength(2);

    globalThis.dispatchEvent(mouse("mouseup", 610, 370));
    expect(container.children).toHaveLength(1);
  });

  it("keeps the gesture away from the map's own handlers", () => {
    const mapHandler = vi.fn();
    container.addEventListener("mousedown", mapHandler);

    canvas.dispatchEvent(mouse("mousedown", 110, 120, true));

    expect(mapHandler).not.toHaveBeenCalled();
  });

  it("leaves plain drags to the map", () => {
    const mapHandler = vi.fn();
    container.addEventListener("mousedown", mapHandler);

    canvas.dispatchEvent(mouse("mousedown", 110, 120));
    globalThis.dispatchEvent(mouse("mousemove", 610, 370));
    globalThis.dispatchEvent(mouse("mouseup", 610, 370));

    expect(mapHandler).toHaveBeenCalled();
    expect(easeTo).not.toHaveBeenCalled();
  });

  it("does nothing on a Shift + click without dragging", () => {
    canvas.dispatchEvent(mouse("mousedown", 110, 120, true));
    globalThis.dispatchEvent(mouse("mouseup", 110, 120));

    expect(easeTo).not.toHaveBeenCalled();
  });

  it("cancels on Escape", () => {
    canvas.dispatchEvent(mouse("mousedown", 110, 120, true));
    globalThis.dispatchEvent(mouse("mousemove", 610, 370));
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    globalThis.dispatchEvent(mouse("mouseup", 610, 370));

    expect(easeTo).not.toHaveBeenCalled();
    expect(container.children).toHaveLength(1);
  });

  it("stops listening once detached", () => {
    detach();

    canvas.dispatchEvent(mouse("mousedown", 110, 120, true));
    globalThis.dispatchEvent(mouse("mousemove", 610, 370));
    globalThis.dispatchEvent(mouse("mouseup", 610, 370));

    expect(easeTo).not.toHaveBeenCalled();
  });
});

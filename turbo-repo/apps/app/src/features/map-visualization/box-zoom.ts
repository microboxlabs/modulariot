/**
 * Shift + drag box zoom that fits the drawn box to the viewport.
 *
 * Mapbox's built-in box zoom fits the north-aligned rectangle spanned by the
 * box's two diagonal corners. On our rotated, tilted maps (bearing/pitch 45)
 * that rectangle is skewed, so the result rarely matches what was drawn.
 * This fits in screen space instead: the ground point under the middle of the
 * box becomes the new center, and the zoom grows until the box fills the
 * viewport. Pitch and bearing are kept.
 */

type Point = { x: number; y: number };

/** The subset of the mapbox-gl Map this handler needs. */
export interface BoxZoomMap {
  /** The sized map element; the viewport size is read from it. */
  getContainer(): HTMLElement;
  /**
   * Receives the mouse events and holds the box. It has no height of its own
   * (the canvas inside is absolutely positioned), so never measure it.
   */
  getCanvasContainer(): HTMLElement;
  unproject(point: [number, number]): { lng: number; lat: number };
  getZoom(): number;
  getMaxZoom(): number;
  easeTo(options: { center: [number, number]; zoom: number }): unknown;
}

/** Drags shorter than this (in px) are treated as clicks. */
const CLICK_TOLERANCE = 3;
/** Boxes thinner than this (in px) on either side are ignored. */
const MIN_BOX_SIZE = 5;

export function getBoxZoomTarget({
  start,
  end,
  width,
  height,
  zoom,
  maxZoom,
}: {
  start: Point;
  end: Point;
  width: number;
  height: number;
  zoom: number;
  maxZoom: number;
}): { center: Point; zoom: number } | null {
  const boxWidth = Math.abs(end.x - start.x);
  const boxHeight = Math.abs(end.y - start.y);
  if (boxWidth < MIN_BOX_SIZE || boxHeight < MIN_BOX_SIZE) return null;

  // Grow until the box's limiting side fills the viewport.
  const scale = Math.min(width / boxWidth, height / boxHeight);
  // An unmeasurable viewport would give log2(0) = -Infinity and zoom out
  if (scale <= 0) return null;

  return {
    center: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    zoom: Math.min(zoom + Math.log2(scale), maxZoom),
  };
}

function createBox(): HTMLDivElement {
  const box = document.createElement("div");
  Object.assign(box.style, {
    position: "absolute",
    top: "0",
    left: "0",
    pointerEvents: "none",
    background: "rgba(255, 255, 255, 0.25)",
    border: "2px dashed #ffffff",
    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.4)",
  });
  return box;
}

function positionBox(box: HTMLDivElement, a: Point, b: Point) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  box.style.transform = `translate(${x}px, ${y}px)`;
  box.style.width = `${Math.abs(b.x - a.x)}px`;
  box.style.height = `${Math.abs(b.y - a.y)}px`;
}

/**
 * Enables Shift + drag box zoom on a map. Pair it with `boxZoom={false}` on
 * the map so the built-in handler stays off. Returns a detach function.
 */
export function attachBoxZoom(map: BoxZoomMap): () => void {
  const container = map.getCanvasContainer();
  let start: Point | null = null;
  let box: HTMLDivElement | null = null;

  const toLocal = (e: MouseEvent): Point => {
    const rect = container.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!start) return;
    const position = toLocal(e);
    if (!box) {
      const distance = Math.hypot(position.x - start.x, position.y - start.y);
      if (distance < CLICK_TOLERANCE) return;
      box = createBox();
      container.appendChild(box);
    }
    positionBox(box, start, position);
  };

  const finish = (end: Point | null) => {
    globalThis.removeEventListener("mousemove", onMouseMove);
    globalThis.removeEventListener("mouseup", onMouseUp);
    globalThis.removeEventListener("keydown", onKeyDown);
    box?.remove();
    box = null;

    const from = start;
    start = null;
    if (!from || !end) return;

    const { clientWidth, clientHeight } = map.getContainer();
    const target = getBoxZoomTarget({
      start: from,
      end,
      width: clientWidth,
      height: clientHeight,
      zoom: map.getZoom(),
      maxZoom: map.getMaxZoom(),
    });
    if (!target) return;

    const { lng, lat } = map.unproject([target.center.x, target.center.y]);
    map.easeTo({ center: [lng, lat], zoom: target.zoom });
  };

  function onMouseUp(e: MouseEvent) {
    if (e.button !== 0) return;
    finish(box ? toLocal(e) : null);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") finish(null);
  }

  const onMouseDown = (e: MouseEvent) => {
    if (!e.shiftKey || e.button !== 0 || start) return;
    // Captured before it reaches the canvas, so Mapbox's drag pan (and
    // deck.gl's picking) never see this gesture.
    e.preventDefault();
    e.stopPropagation();
    start = toLocal(e);
    globalThis.addEventListener("mousemove", onMouseMove);
    globalThis.addEventListener("mouseup", onMouseUp);
    globalThis.addEventListener("keydown", onKeyDown);
  };

  container.addEventListener("mousedown", onMouseDown, true);

  return () => {
    container.removeEventListener("mousedown", onMouseDown, true);
    finish(null);
  };
}

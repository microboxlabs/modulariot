import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PointPicker from "./point-picker";

const { renderMap } = vi.hoisted(() => ({ renderMap: vi.fn() }));

vi.mock("react-map-gl", () => ({
  default: () => {
    renderMap();
    return <div data-testid="map" />;
  },
  Marker: () => null,
  NavigationControl: () => null,
}));
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => ({ MAPBOX_API_KEY: "synthetic-token" }),
}));

const props = {
  center: { latitude: 0, longitude: 0 },
  point: null,
  onPoint: vi.fn(),
  label: "Map",
  unavailable: "Map unavailable",
};

beforeEach(() => renderMap.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("PointPicker", () => {
  it("shows the unavailable message when only WebGL 1 is available", () => {
    const webgl1 = {
      canvas: document.createElement("canvas"),
    } as WebGLRenderingContext;
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((id) => (id === "webgl" ? webgl1 : null));

    render(<PointPicker {...props} />);

    expect(screen.getByText("Map unavailable")).toBeInTheDocument();
    expect(getContext).toHaveBeenCalledWith("webgl2");
    expect(renderMap).not.toHaveBeenCalled();
  });

  it("mounts the map when WebGL 2 is available", () => {
    const webgl2 = {
      canvas: document.createElement("canvas"),
    } as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (id) => (id === "webgl2" ? webgl2 : null)
    );

    render(<PointPicker {...props} />);

    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.queryByText("Map unavailable")).not.toBeInTheDocument();
  });
});

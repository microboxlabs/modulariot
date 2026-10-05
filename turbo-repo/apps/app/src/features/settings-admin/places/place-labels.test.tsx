import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import PlaceLabels, { anclaLugar } from "./place-labels";
import type { Lugar } from "./places.types";

const zoom = vi.hoisted(() => ({ current: 14 }));

vi.mock("react-map-gl", () => ({
  Marker: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: (e: { originalEvent: { stopPropagation: () => void } }) => void;
  }) => (
    <div
      data-testid="marker"
      onClick={() => onClick?.({ originalEvent: { stopPropagation: vi.fn() } })}
    >
      {children}
    </div>
  ),
  useMap: () => {
    const m = { getZoom: () => zoom.current, on: vi.fn(), off: vi.fn() };
    return { current: { getZoom: m.getZoom, getMap: () => m } };
  },
}));

const lugar = (over: Partial<Lugar>): Lugar => ({
  place_id: "p1",
  name: "Planta Norte",
  address: null,
  category: null,
  category_id: null,
  geometry_type: "circle",
  color: "#FF0000",
  center: [-33, -70],
  polygon: null,
  radius_m: 250,
  metadata: null,
  external_id: null,
  active_from: null,
  active_until: null,
  ...over,
});

describe("place labels", () => {
  it("anchors circles at the centre and polygons at the centroid", () => {
    expect(anclaLugar({ center: [1, 2], polygon: null })).toEqual([1, 2]);
    expect(
      anclaLugar({
        center: [9, 9],
        polygon: [
          [0, 0],
          [0, 2],
          [2, 2],
          [2, 0],
        ],
      })
    ).toEqual([1, 1]);
  });

  it("shows names when zoomed in and opens a place on click", () => {
    zoom.current = 14;
    const onSelect = vi.fn();
    render(
      <PlaceLabels
        lugares={[lugar({}), lugar({ place_id: "p2", name: "Oculto" })]}
        ocultarId="p2"
        interactivo
        onSelect={onSelect}
      />
    );
    expect(screen.getByText("Planta Norte")).toBeInTheDocument();
    expect(screen.queryByText("Oculto")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("marker"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ place_id: "p1" })
    );
  });

  it("shows only the icon when zoomed out, and ignores clicks when not interactive", () => {
    zoom.current = 8;
    const onSelect = vi.fn();
    render(
      <PlaceLabels
        lugares={[lugar({})]}
        ocultarId={null}
        interactivo={false}
        onSelect={onSelect}
      />
    );
    expect(screen.queryByText("Planta Norte")).not.toBeInTheDocument();
    expect(screen.getByTitle("Planta Norte")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("marker"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

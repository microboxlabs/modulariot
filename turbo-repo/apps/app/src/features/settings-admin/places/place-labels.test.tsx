import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import PlaceLabels, {
  GeofenceNameOverlay,
  anclaFueraLugar,
  anclaLugar,
  itemsDesdeFC,
  posicionEtiquetaPx,
  puntoEtiqueta,
} from "./place-labels";
import { PARENT_KEY, type Lugar } from "./places.types";

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
    const m = {
      getZoom: () => zoom.current,
      on: vi.fn(),
      off: vi.fn(),
      getContainer: () => document.body,
      project: (lngLat: [number, number]) => ({
        x: lngLat[0],
        y: lngLat[1],
      }),
    };
    return {
      current: {
        getZoom: m.getZoom,
        getMap: () => m,
        project: m.project,
      },
    };
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
  it("projects the name onto the geofence centre in pixel space", () => {
    const p = posicionEtiquetaPx(
      (lngLat) => ({ x: lngLat[0], y: lngLat[1] }),
      [-33, -70]
    );
    expect(p).toEqual({ x: -70, y: -33 });
  });

  it("shows the geofence name on the map overlay, centered", () => {
    render(
      <GeofenceNameOverlay
        items={[
          {
            id: "p1",
            name: "geofence 1 de prueba",
            color: "#1C64F2",
            icon: "",
            ancla: [-33, -70],
          },
        ]}
        interactivo={false}
      />
    );
    expect(screen.getByText("geofence 1 de prueba")).toBeInTheDocument();
    expect(screen.getByTestId("geofence-names")).toBeInTheDocument();
  });

  it("places the GeoJSON name on the geofence centre", () => {
    const f = puntoEtiqueta(
      [-33, -70],
      "geofence 1 de prueba",
      "#1C64F2",
      "p1"
    );
    expect(f?.geometry.coordinates).toEqual([-70, -33]);
    expect(f?.properties).toMatchObject({
      name: "geofence 1 de prueba",
      place_id: "p1",
      inner: false,
    });
  });

  it("builds parent and child chips from the painted geofence polygons", () => {
    const fc = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {
            name: "geofence 1 de prueba",
            place_id: "park",
            inner: false,
            radius_m: 250,
            color: "#1C64F2",
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [-70.1, -33.1],
                [-69.9, -33.1],
                [-69.9, -32.9],
                [-70.1, -32.9],
                [-70.1, -33.1],
              ],
            ],
          },
        },
        {
          type: "Feature" as const,
          properties: {
            name: "Lote VIP",
            place_id: "lot",
            inner: true,
            parent_id: "park",
            radius_m: 40,
            color: "#E02424",
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [-70.01, -33.01],
                [-69.99, -33.01],
                [-69.99, -32.99],
                [-70.01, -32.99],
                [-70.01, -33.01],
              ],
            ],
          },
        },
      ],
    };
    const items = itemsDesdeFC(fc);
    expect(items.map((i) => i.name)).toEqual([
      "geofence 1 de prueba",
      "Lote VIP",
    ]);
    expect(items[0]).toMatchObject({
      inner: false,
      id: "park",
      radio_m: 250,
    });
    expect(items[1]).toMatchObject({
      inner: true,
      id: "lot",
      parentId: "park",
      radio_m: 40,
    });
  });

  it("shows the parent chip next to the child chip on the overlay", () => {
    render(
      <GeofenceNameOverlay
        items={[
          {
            id: "park",
            name: "geofence 1 de prueba",
            color: "#1C64F2",
            icon: "",
            ancla: [-33, -70],
            inner: false,
          },
          {
            id: "lot",
            name: "Lote VIP",
            color: "#E02424",
            icon: "",
            ancla: [-33, -70],
            inner: true,
          },
        ]}
        interactivo={false}
      />
    );
    expect(screen.getByText("geofence 1 de prueba")).toBeInTheDocument();
    expect(screen.getByText("Lote VIP")).toBeInTheDocument();
    expect(
      screen.getByText("geofence 1 de prueba").closest("[data-geofence-role]")
    ).toHaveAttribute("data-geofence-role", "padre");
    expect(screen.getByTestId("geofence-names")).toHaveClass(
      "pointer-events-none"
    );
  });

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

  it("puts the parent name north of the circle, outside the geofence", () => {
    const p = anclaFueraLugar(
      lugar({ center: [-33, -70], radius_m: 250, polygon: null })
    );
    expect(p?.[0]).toBeGreaterThan(-33);
    expect(p?.[1]).toBeCloseTo(-70, 5);
  });

  it("shows parent and child names at any zoom", () => {
    zoom.current = 2;
    const { rerender } = render(
      <PlaceLabels
        lugares={[
          lugar({
            place_id: "park",
            name: "Estacionamiento",
            radius_m: 250,
          }),
          lugar({
            place_id: "lot",
            name: "Lote VIP",
            radius_m: 40,
            metadata: { [PARENT_KEY]: "park" },
          }),
        ]}
        ocultarId={null}
        interactivo={false}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText("Estacionamiento")).toBeInTheDocument();
    expect(screen.getByText("Lote VIP")).toBeInTheDocument();

    zoom.current = 18;
    rerender(
      <PlaceLabels
        lugares={[
          lugar({
            place_id: "park",
            name: "Estacionamiento",
            radius_m: 250,
          }),
          lugar({
            place_id: "lot",
            name: "Lote VIP",
            radius_m: 40,
            metadata: { [PARENT_KEY]: "park" },
          }),
        ]}
        ocultarId={null}
        interactivo={false}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText("Estacionamiento")).toBeInTheDocument();
    expect(screen.getByText("Lote VIP")).toBeInTheDocument();
    const markers = screen.getAllByTestId("marker");
    expect(markers.at(-1)).toHaveTextContent("Estacionamiento");
  });

  it("shows the geofence name when zoomed out, and ignores clicks when not interactive", () => {
    zoom.current = 2;
    const onSelect = vi.fn();
    render(
      <PlaceLabels
        lugares={[lugar({})]}
        ocultarId={null}
        interactivo={false}
        onSelect={onSelect}
      />
    );
    expect(screen.getByText("Planta Norte")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("marker"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

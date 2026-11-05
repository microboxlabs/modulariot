import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import MapVisualization from "./map-visualization";

const mapProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => ({ MAPBOX_API_KEY: "pk.test" }),
}));
vi.mock("@deck.gl/mapbox", () => ({ MapboxOverlay: vi.fn() }));
vi.mock("react-map-gl", () => ({
  default: ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: (e: unknown) => void;
  }) => {
    mapProps.current = rest;
    return (
      <div
        data-testid="map"
        onClick={() => onClick?.({ lngLat: { lng: -70, lat: -33 } })}
      >
        {children}
      </div>
    );
  },
  useControl: () => ({ setProps: vi.fn() }),
}));

describe("MapVisualization", () => {
  it("renders native children and forwards base-map clicks", () => {
    const onMapClick = vi.fn();
    render(
      <MapVisualization
        mapStyle="streets"
        layers={[]}
        mapRef={{ current: null }}
        onMapClick={onMapClick}
      >
        <span>native child</span>
      </MapVisualization>
    );

    expect(screen.getByText("native child")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("map"));
    expect(onMapClick).toHaveBeenCalledWith({
      lngLat: { lng: -70, lat: -33 },
    });
  });

  it("uses the provided initial view state", () => {
    const view = { longitude: -70.9, latitude: -33.3, zoom: 6.5 };
    render(
      <MapVisualization
        mapStyle="streets"
        layers={[]}
        mapRef={{ current: null }}
        initialViewState={view}
      />
    );

    expect(mapProps.current.initialViewState).toEqual(view);
  });

  it("uses the idle cursor override instead of grab", () => {
    const { rerender } = render(
      <MapVisualization
        mapStyle="streets"
        layers={[]}
        mapRef={{ current: null }}
      />
    );
    expect(mapProps.current.cursor).toBe("grab");

    rerender(
      <MapVisualization
        mapStyle="streets"
        layers={[]}
        mapRef={{ current: null }}
        idleCursor="crosshair"
      />
    );
    expect(mapProps.current.cursor).toBe("crosshair");
  });

  it("forwards right clicks on the base map", () => {
    const onMapContextMenu = vi.fn();
    render(
      <MapVisualization
        mapStyle="streets"
        layers={[]}
        mapRef={{ current: null }}
        onMapContextMenu={onMapContextMenu}
      />
    );
    expect(mapProps.current.onContextMenu).toBe(onMapContextMenu);
  });
});

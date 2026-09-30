import { describe, it, expect, vi } from "vitest";
import type { MapRef } from "react-map-gl";
import { VEHICLE_FOCUS_ZOOM, zoomToVehicle } from "./map-view-utils";

function fakeMap(zoom: number) {
  return { getZoom: () => zoom, flyTo: vi.fn<MapRef["flyTo"]>() };
}

describe("zoomToVehicle", () => {
  it("flies to the vehicle and zooms in on it", () => {
    const map = fakeMap(5);

    zoomToVehicle(map, [-70.6, -33.4]);

    expect(map.flyTo).toHaveBeenCalledWith({
      center: [-70.6, -33.4],
      zoom: VEHICLE_FOCUS_ZOOM,
      duration: 1000,
    });
  });

  it("never zooms out when the user is already closer", () => {
    const map = fakeMap(18);

    zoomToVehicle(map, [-70.6, -33.4]);

    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 18 })
    );
  });
});

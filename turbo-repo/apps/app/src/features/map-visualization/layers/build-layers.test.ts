import { describe, expect, it } from "vitest";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer_clustered";
import { buildNamedMapLayers } from "./build-layers";

describe("named vehicle pins", () => {
  it.each([
    { properties: { engine_off: null, engine_status: "off" }, off: true },
    { properties: { engine_off: undefined, engine_status: "off" }, off: true },
    { properties: { engine_status: "off" }, off: true },
    { properties: { engine_off: false, engine_status: "off" }, off: false },
    { properties: { engine_off: true, engine_status: "on" }, off: true },
    { properties: {}, off: false },
  ])("normalizes $properties to engine_off=$off", ({ properties, off }) => {
    const [layer] = buildNamedMapLayers([
      {
        layer: {
          id: "vehicles",
          name: "Vehicles",
          geometryType: "Point",
          style: { pointMode: "pin" },
        },
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [-70, -33] },
              properties,
            },
          ],
        },
      },
    ]);

    expect(layer).toBeInstanceOf(PinLayer);
    expect((layer as PinLayer).props.data).toEqual([
      expect.objectContaining({
        longitude: -70,
        latitude: -33,
        engine_off: off,
        lost_signal: false,
      }),
    ]);
  });
});

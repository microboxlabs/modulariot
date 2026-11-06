import { describe, expect, it, vi } from "vitest";
import { PinLayer } from "./pin_layer_clustered";
import { createSVGIcon } from "../prototype/svg-generation";

function clusteredPins(data: Record<string, unknown>[]) {
  const layer = new PinLayer({ id: "vehicles", data, zoom: 12 });
  layer.state = { clusters: [] };
  vi.spyOn(layer, "setState").mockImplementation((state) => {
    Object.assign(layer.state, state);
  });
  layer.updateState({
    props: layer.props,
    changeFlags: { propsOrDataChanged: true },
  });
  const [icons] = layer.renderLayers();
  const { getIcon } = icons.props as unknown as {
    getIcon: (d: object) => { url: string };
  };
  return layer.state.clusters.map((feature) => getIcon(feature).url);
}

const position = {
  longitude: -70,
  latitude: -33,
  speed_limit_condition: 1,
};

describe("clustered vehicle pins", () => {
  it.each([
    { engine_off: true, lost_signal: false },
    { engine_off: true, lost_signal: true },
    { engine_off: false, lost_signal: true },
    { engine_off: false, lost_signal: false },
  ])("renders a single vehicle with %j", ({ engine_off, lost_signal }) => {
    expect(clusteredPins([{ ...position, engine_off, lost_signal }])).toEqual([
      createSVGIcon(1, lost_signal, engine_off),
    ]);
  });

  it("keeps the normal pin for an unknown engine state", () => {
    expect(clusteredPins([position])).toEqual([createSVGIcon(1, false)]);
  });

  it("keeps a cluster colored when its engines are off", () => {
    expect(
      clusteredPins([
        { ...position, engine_off: true },
        { ...position, engine_off: true },
      ])
    ).toEqual([createSVGIcon(1, false)]);
  });
});

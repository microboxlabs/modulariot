import { describe, expect, it, vi } from "vitest";
import { PinLayer } from "./pin_layer_clustered";
import { createSVGIcon } from "../prototype/svg-generation";
import { WebMercatorViewport } from "@deck.gl/core";
import type { UpdateParameters } from "@deck.gl/core";
import type { IconLayer } from "deck.gl";

function clusteredLayer(data: Record<string, unknown>[]) {
  const layer = new PinLayer({ id: "vehicles", data, zoom: 12 });
  vi.spyOn(layer, "setState").mockImplementation((state) => {
    layer.state = { ...layer.state, ...state };
  });
  layer.initializeState(layer.context);
  layer.updateState({
    props: layer.props,
    changeFlags: { propsOrDataChanged: true, dataChanged: true },
  });
  return layer;
}

function clusteredPins(data: Record<string, unknown>[]) {
  const layer = clusteredLayer(data);
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

describe("clustered pin view updates", () => {
  it("preserves the spatial index when deck.gl transfers state to a replacement layer", () => {
    const layer = clusteredLayer([position]);
    const next = new PinLayer({ ...layer.props, zoom: 13 });
    next.state = layer.state;
    vi.spyOn(next, "setState").mockImplementation((state) => {
      next.state = { ...next.state, ...state };
    });
    next.updateState({
      props: next.props,
      oldProps: layer.props,
      changeFlags: { propsOrDataChanged: true },
    });
    expect(next.supercluster).toBe(layer.supercluster);
    expect(next.state.clusters).toHaveLength(1);
  });

  it("reuses the index and clusters within a zoom level, querying only at integer zooms", () => {
    const layer = clusteredLayer([position]);
    const load = vi.spyOn(layer.supercluster, "load");
    const query = vi.spyOn(layer.supercluster, "getClusters");
    for (const zoom of [12, 12.1, 12.5, 12.9, 13]) {
      layer.updateState({
        props: { ...layer.props, zoom },
        oldProps: layer.props,
        changeFlags: { propsOrDataChanged: true, viewportChanged: true },
      });
    }
    expect(load).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledExactlyOnceWith([-180, -85, 180, 85], 13);
  });

  it("reloads changed vehicle data even within the same zoom level", () => {
    const layer = clusteredLayer([position]);
    const load = vi.spyOn(layer.supercluster, "load");
    layer.updateState({
      props: { ...layer.props, data: [{ ...position, heading: 90 }] },
      oldProps: layer.props,
      changeFlags: { propsOrDataChanged: true, dataChanged: true },
    });
    expect(load).toHaveBeenCalledOnce();
    expect(layer.state.clusters[0].properties.heading).toBe(90);
  });

  it("updates both pin and badge direction with the viewport, keeping clusters upright", () => {
    const layer = clusteredLayer([
      { ...position, heading: 90 },
      { ...position, heading: 90 },
      { ...position, longitude: -71, heading: 90, symptoms_condition: 1 },
    ]);
    type Feature = (typeof layer.state.clusters)[number];
    type Angle = (d: Feature, info: { index: number }) => number;
    const layers = () => layer.renderLayers() as IconLayer<Feature>[];
    const firstKey = layers()[0].props.updateTriggers?.getAngle;
    layer.context = {
      ...layer.context,
      viewport: new WebMercatorViewport({
        width: 800,
        height: 600,
        longitude: -70,
        latitude: -33,
        zoom: 12,
        bearing: 90,
        pitch: 60,
      }),
    };
    expect(
      layer.shouldUpdateState({
        changeFlags: { somethingChanged: true },
      } as UpdateParameters<PinLayer>)
    ).toBe(true);
    const [base, , badge] = layers();
    expect(base.props.updateTriggers?.getAngle).not.toBe(firstKey);
    const angle = base.props.getAngle as Angle;
    const badgeAngle = badge.props.getAngle as Angle;
    const offset = badge.props.getPixelOffset as (
      d: Feature,
      info: { index: number }
    ) => readonly [number, number];
    layer.state.clusters.forEach((feature, index) => {
      const info = { index };
      expect(badgeAngle(feature, info)).toBe(angle(feature, info));
      if (feature.properties.cluster) expect(angle(feature, info)).toBe(0);
      const [x, y] = offset(feature, info);
      expect(x).toBeCloseTo(0, 2);
      expect(y).toBeLessThan(0);
    });
    expect(badge.props.updateTriggers?.getPixelOffset).toBe(
      base.props.updateTriggers?.getAngle
    );
  });
});

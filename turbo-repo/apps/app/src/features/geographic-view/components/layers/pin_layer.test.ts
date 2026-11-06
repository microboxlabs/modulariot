import { describe, expect, it } from "vitest";
import { PinLayer } from "./pin_layer";
import { createSVGIcon } from "../prototype/svg-generation";

const position = {
  assetid: "AB12",
  heading: 0,
  latitude: -33,
  location: "",
  longitude: -70,
  speed: 0,
  timestamp: "2026-11-03T11:48:00Z",
};

function render(props: Record<string, unknown>) {
  return new PinLayer({ id: "pin", data: [position], ...props }).renderLayers();
}

function iconUrl(layers: ReturnType<typeof render>): string {
  const { getIcon } = layers[0].props as unknown as {
    getIcon: (d: unknown) => { url: string };
  };
  return getIcon(position).url;
}

describe("PinLayer", () => {
  it("keeps today's pin while the signal arrives or is unknown", () => {
    const layers = render({ offline: false, label: null });
    expect(layers).toHaveLength(1);
    expect(iconUrl(layers)).toBe(createSVGIcon(1, false));
  });

  it("draws an offline vehicle gray with its label beside it", () => {
    const layers = render({ offline: true, label: "Sin señal · hace 12 min" });
    expect(iconUrl(layers)).toBe(createSVGIcon(1, true));
    expect(iconUrl(layers)).not.toBe(createSVGIcon(1, false));
    expect(layers).toHaveLength(2);
    const { getText } = layers[1].props as unknown as {
      getText: (d: unknown) => string;
    };
    expect(getText(position)).toBe("Sin señal · hace 12 min");
  });
});

describe("PinLayer with the engine off", () => {
  it("draws the pin gray with its normal face and the engine-off label", () => {
    const layers = render({ engineOff: true, label: "Motor apagado" });
    expect(iconUrl(layers)).toBe(createSVGIcon(1, false, true));
    expect(iconUrl(layers)).not.toBe(createSVGIcon(1, true));
    expect(layers).toHaveLength(2);
    const { getText } = layers[1].props as unknown as {
      getText: (d: unknown) => string;
    };
    expect(getText(position)).toBe("Motor apagado");
  });

  it("draws the offline pin when the signal is also lost", () => {
    const layers = render({
      offline: true,
      engineOff: true,
      label: "Sin señal · hace 12 min",
    });
    expect(iconUrl(layers)).toBe(createSVGIcon(1, true));
  });

  it("keeps today's pin when the engine state is unknown", () => {
    const layers = render({ label: null });
    expect(iconUrl(layers)).toBe(createSVGIcon(1, false));
    expect(layers).toHaveLength(1);
  });
});

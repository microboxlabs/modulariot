import { render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlechasRuta, IMAGEN_FLECHA, useFlechaRuta } from "./route-arrows";

const estado = vi.hoisted(() => ({
  imagenes: new Set<string>(),
  oyentes: new Map<string, (e: { id: string }) => void>(),
  propsCapa: [] as Record<string, unknown>[],
}));

const mapa = {
  hasImage: (id: string) => estado.imagenes.has(id),
  addImage: vi.fn((id: string) => estado.imagenes.add(id)),
  on: (ev: string, fn: (e: { id: string }) => void) =>
    estado.oyentes.set(ev, fn),
  off: (ev: string) => estado.oyentes.delete(ev),
};

vi.mock("react-map-gl", () => ({
  Layer: (props: Record<string, unknown>) => {
    estado.propsCapa.push(props);
    return null;
  },
  useMap: () => ({ current: { getMap: () => mapa } }),
}));

// canvas con lo justo para dibujar la flecha
HTMLCanvasElement.prototype.getContext = function () {
  return {
    scale: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    getImageData: () => ({
      width: 28,
      height: 28,
      data: new Uint8ClampedArray(28 * 28 * 4),
    }),
  } as unknown as CanvasRenderingContext2D;
} as unknown as HTMLCanvasElement["getContext"];

describe("useFlechaRuta", () => {
  it("adds the arrow image, and again when a new style asks for it", () => {
    renderHook(() => useFlechaRuta());
    expect(mapa.addImage).toHaveBeenCalledTimes(1);
    expect(mapa.addImage.mock.calls[0]?.[0]).toBe(IMAGEN_FLECHA);

    // a style change drops custom images; Mapbox asks for the missing one
    estado.imagenes.clear();
    estado.oyentes.get("styleimagemissing")?.({ id: IMAGEN_FLECHA });
    expect(mapa.addImage).toHaveBeenCalledTimes(2);
    // other missing images are not ours
    estado.oyentes.get("styleimagemissing")?.({ id: "otra" });
    expect(mapa.addImage).toHaveBeenCalledTimes(2);
  });

  it("passes on the source id that <Source> gives its children", () => {
    render(<FlechasRuta id="tray-flechas" source="tray" />);
    expect(estado.propsCapa.at(-1)).toMatchObject({
      id: "tray-flechas",
      type: "symbol",
      source: "tray",
    });
  });
});

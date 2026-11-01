import { describe, expect, it, vi } from "vitest";
import type { MapRef } from "react-map-gl";
import {
  cajaDePuntos,
  camaraMercator,
  camaraValida,
  encuadrarCaja,
  margenQueCabe,
  ubicarPuntoEnMapa,
  type Caja,
} from "./places-map-camera";

// Los Ángeles (Chile) → Zürich (8FVC9G8F+6X): the route that broke fitBounds
const losAngeles: [number, number] = [-37.4697, -72.3537];
const zurich: [number, number] = [47.3655625, 8.5249375];
const caja: Caja = cajaDePuntos([losAngeles, zurich]);
const margen = { top: 60, bottom: 60, left: 60, right: 500 };

function mapaFalso(cam: unknown) {
  const map = {
    getContainer: () => ({ clientWidth: 800, clientHeight: 600 }),
    cameraForBounds: vi.fn(() => cam),
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
  };
  return map;
}

describe("places map camera", () => {
  it("boxes points as [[lonMin, latMin], [lonMax, latMax]]", () => {
    expect(caja).toEqual([
      [-72.3537, -37.4697],
      [8.5249375, 47.3655625],
    ]);
  });

  it("shrinks margins that would not fit in the map", () => {
    // 60 + 500 = 560 fits in 800 wide; on a 400 wide map they shrink
    expect(margenQueCabe(margen, 800, 600)).toEqual(margen);
    const chico = margenQueCabe(margen, 400, 600);
    expect(chico.left + chico.right).toBeCloseTo(360);
    expect(chico.right / chico.left).toBeCloseTo(500 / 60);
  });

  it("accepts only a camera with real numbers", () => {
    expect(camaraValida({ center: [1, 2], zoom: 3 })).toEqual({
      centro: [1, 2],
      zoom: 3,
    });
    expect(camaraValida({ center: { lng: 1, lat: 2 }, zoom: 3 })).toEqual({
      centro: [1, 2],
      zoom: 3,
    });
    expect(
      camaraValida({ center: [Number.NaN, Number.NaN], zoom: 3 })
    ).toBeNull();
    expect(camaraValida({ center: [1, 2], zoom: Number.NaN })).toBeNull();
    expect(camaraValida(undefined)).toBeNull();
  });

  it("works out a Mercator camera that keeps both ends in view", () => {
    const { centro, zoom } = camaraMercator(caja, margen, 800, 600, 16);
    expect(centro.every(Number.isFinite)).toBe(true);
    // a whole-world box: zoomed far out, centred between both ends
    expect(zoom).toBeGreaterThanOrEqual(0);
    expect(zoom).toBeLessThan(2);
    expect(centro[1]).toBeGreaterThan(-37.4697);
    expect(centro[1]).toBeLessThan(47.3655625);
  });

  it("falls back to its own camera when Mapbox gives NaN", () => {
    const map = mapaFalso({ center: { lng: Number.NaN, lat: Number.NaN } });
    encuadrarCaja(map as unknown as MapRef, caja, {
      margen,
      maxZoom: 16,
      duration: 800,
    });
    expect(map.fitBounds).not.toHaveBeenCalled();
    const [{ center, zoom }] = map.flyTo.mock.calls[0]! as unknown as [
      { center: [number, number]; zoom: number },
    ];
    expect(center.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(zoom)).toBe(true);
  });

  it("also falls back when Mapbox throws", () => {
    const map = mapaFalso(null);
    map.cameraForBounds.mockImplementation(() => {
      throw new Error("Invalid LngLat object: (NaN, NaN)");
    });
    encuadrarCaja(map as unknown as MapRef, caja, {
      margen,
      maxZoom: 16,
      duration: 800,
    });
    expect(map.flyTo).toHaveBeenCalled();
  });

  it("keeps Mapbox's fitBounds when its camera is valid", () => {
    const map = mapaFalso({ center: [-30, 5], zoom: 1.2 });
    encuadrarCaja(map as unknown as MapRef, caja, {
      margen,
      maxZoom: 16,
      duration: 800,
    });
    expect(map.fitBounds).toHaveBeenCalledWith(caja, {
      padding: margen,
      maxZoom: 16,
      duration: 800,
    });
    expect(map.flyTo).not.toHaveBeenCalled();
  });
});

describe("ubicarPuntoEnMapa", () => {
  it("unpacks [lat, lon] so the camera gets numbers, not an array", () => {
    const encuadrar = vi.fn();
    ubicarPuntoEnMapa([-33.4, -70.57], 250, encuadrar);
    expect(encuadrar).toHaveBeenCalledWith(-33.4, -70.57, 250);
  });
});

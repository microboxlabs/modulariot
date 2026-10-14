import { describe, expect, it, vi } from "vitest";
import { ubicarPuntoEnMapa } from "./places-map-camera";

describe("ubicarPuntoEnMapa", () => {
  it("unpacks [lat, lon] so the camera gets numbers, not an array", () => {
    const encuadrar = vi.fn();
    ubicarPuntoEnMapa([-33.4, -70.57], 250, encuadrar);
    expect(encuadrar).toHaveBeenCalledWith(-33.4, -70.57, 250);
  });
});

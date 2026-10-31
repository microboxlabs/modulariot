import { describe, expect, it } from "vitest";
import {
  PX_ABRIR_INTERIORES,
  radioLugarM,
  zoomAbrirInteriores,
  zoomAlClicNombre,
  zoomParaTamanoPx,
} from "./geofence-lod";
import type { Lugar } from "../places.types";

const lugar = (over: Partial<Lugar>): Lugar => ({
  place_id: "p1",
  name: "Planta",
  address: null,
  category: null,
  category_id: null,
  geometry_type: "circle",
  color: null,
  center: [-33, -70],
  polygon: null,
  radius_m: 250,
  metadata: null,
  external_id: null,
  active_from: null,
  active_until: null,
  ...over,
});

describe("geofence lod", () => {
  it("fits the requested pixel radius in Mapbox's 512-pixel world", () => {
    const radius = 250;
    const latitude = -33;
    const zoom = zoomParaTamanoPx(radius, latitude, 140);
    const metersPerPixel =
      (40075016.68557849 * Math.cos((latitude * Math.PI) / 180)) /
      (512 * 2 ** zoom);
    expect(radius / metersPerPixel).toBeCloseTo(140, 4);
  });
  it("uses the circle radius or the polygon envelope", () => {
    expect(radioLugarM(lugar({ radius_m: 400 }))).toBe(400);
    expect(
      radioLugarM(
        lugar({
          geometry_type: "polygon",
          polygon: [
            [0, 0],
            [0, 0.002],
            [0.002, 0.002],
            [0.002, 0],
          ],
        })
      )
    ).toBeGreaterThan(100);
  });

  it("needs more zoom for a small geofence than for a large one", () => {
    const chico = zoomParaTamanoPx(250, -33, PX_ABRIR_INTERIORES);
    const grande = zoomParaTamanoPx(2000, -33, PX_ABRIR_INTERIORES);
    expect(grande).toBeLessThan(chico);
  });

  it("opens inners of a large parent earlier than a small one", () => {
    const padreChico = lugar({ place_id: "park", radius_m: 250 });
    const padreGrande = lugar({ place_id: "planta", radius_m: 2000 });
    expect(zoomAbrirInteriores(padreGrande)).toBeLessThan(
      zoomAbrirInteriores(padreChico)
    );
  });

  const padreNom = {
    id: "park",
    ancla: [-33, -70] as [number, number],
    inner: false,
    radio_m: 250,
  };
  const hijoNom = {
    id: "lot",
    ancla: [-33, -70] as [number, number],
    inner: true,
    parentId: "park",
    radio_m: 40,
  };

  it("zooms past the cluster when clicking the parent name", () => {
    const zAbre = zoomAbrirInteriores({
      center: [-33, -70],
      polygon: null,
      radius_m: 250,
    });
    expect(zoomAlClicNombre(padreNom, 4, [padreNom, hijoNom])).toBeGreaterThan(
      zAbre
    );
  });
});

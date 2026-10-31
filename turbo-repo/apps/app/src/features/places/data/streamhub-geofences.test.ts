import { describe, expect, it } from "vitest";
import {
  PREFIJO_STREAMHUB,
  esDeStreamhub,
  lugarDesdeGeofence,
} from "./streamhub-geofences";
import type { StreamhubGeofenceRow } from "@/app/api/utils/pgrest-client";

const fila = (
  over: Partial<StreamhubGeofenceRow> = {}
): StreamhubGeofenceRow => ({
  geofence_id: 1156,
  client_geofence_id: "base-exacta",
  geofence_name: "BASE EXACTA",
  polygon_type: "polygonal",
  coordinates: "ignored here",
  properties: { category: "cd", address: "Av. Siempre Viva 742" },
  ...over,
});

// [lon, lat], closed like PostGIS rings
const anillo: [number, number][] = [
  [-70, -33],
  [-70, -32],
  [-69, -32],
  [-69, -33],
  [-70, -33],
];

describe("streamhub geofences as places", () => {
  it("turns a row into a read-only polygon place", () => {
    const l = lugarDesdeGeofence(fila(), anillo);
    expect(l).toMatchObject({
      place_id: `${PREFIJO_STREAMHUB}1156`,
      name: "BASE EXACTA",
      external_id: "base-exacta",
      category: null,
      address: "Av. Siempre Viva 742",
      geometry_type: "polygon",
      radius_m: null,
    });
    // [lat, lon] and without the repeated closing point
    expect(l?.polygon).toEqual([
      [-33, -70],
      [-32, -70],
      [-32, -69],
      [-33, -69],
    ]);
    expect(l?.center).toEqual([-32.5, -69.5]);
  });

  it("falls back to the code, then the id, for the name", () => {
    expect(lugarDesdeGeofence(fila({ geofence_name: " " }), anillo)?.name).toBe(
      "base-exacta"
    );
    expect(
      lugarDesdeGeofence(
        fila({ geofence_name: null, client_geofence_id: null }),
        anillo
      )?.name
    ).toBe("Geocerca 1156");
  });

  it("ignores non-text properties", () => {
    const l = lugarDesdeGeofence(fila({ properties: { address: "" } }), anillo);
    expect(l?.address).toBeNull();
  });

  it("takes the category only from the geofence_category column", () => {
    const categoria = (geofence_category: string | null | undefined) =>
      lugarDesdeGeofence(
        fila({
          geofence_category,
          properties: { category: "cd", geofence_type: 1 },
        }),
        anillo
      )?.category;
    expect(categoria(" Planta ")).toBe("Planta");
    // empty or not deployed yet: no category, never the properties or type
    expect(categoria("  ")).toBeNull();
    expect(categoria(null)).toBeNull();
    expect(categoria(undefined)).toBeNull();
  });

  it("tells StreamHub geofences from places created here", () => {
    expect(esDeStreamhub("streamhub-1156")).toBe(true);
    expect(esDeStreamhub("local-abc")).toBe(false);
    expect(esDeStreamhub(null)).toBe(false);
  });

  it("drops rows without a usable shape", () => {
    expect(lugarDesdeGeofence(fila(), null)).toBeNull();
    expect(
      lugarDesdeGeofence(fila(), [
        [-70, -33],
        [-70, -32],
        [-70, -33],
      ])
    ).toBeNull();
  });
});

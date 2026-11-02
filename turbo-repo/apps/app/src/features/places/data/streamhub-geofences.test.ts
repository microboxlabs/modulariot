import { describe, expect, it } from "vitest";
import {
  PREFIJO_STREAMHUB,
  anilloExterior,
  esDeStreamhub,
  geocercaModulithSchema,
  lugarDesdeGeofence,
  type GeocercaModulith,
} from "./streamhub-geofences";

// [lon, lat], closed like PostGIS rings
const anillo: [number, number][] = [
  [-70, -33],
  [-70, -32],
  [-69, -32],
  [-69, -33],
  [-70, -33],
];

const geocerca = (over: Partial<GeocercaModulith> = {}): GeocercaModulith => ({
  id: 1156,
  code: "base-exacta",
  name: "BASE EXACTA",
  polygonType: "polygonal",
  category: null,
  shape: { type: "Polygon", coordinates: [anillo] },
  properties: { category: "cd", address: "Av. Siempre Viva 742" },
  ...over,
});

describe("streamhub geofences as places", () => {
  it("turns a geofence into a read-only polygon place", () => {
    const l = lugarDesdeGeofence(geocerca());
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
    expect(lugarDesdeGeofence(geocerca({ name: " " }))?.name).toBe(
      "base-exacta"
    );
    expect(lugarDesdeGeofence(geocerca({ name: null, code: null }))?.name).toBe(
      "Geocerca 1156"
    );
  });

  it("ignores non-text properties", () => {
    const l = lugarDesdeGeofence(geocerca({ properties: { address: "" } }));
    expect(l?.address).toBeNull();
  });

  it("takes the category only from the geofence_category column", () => {
    const categoria = (category: string | null) =>
      lugarDesdeGeofence(
        geocerca({ category, properties: { category: "cd", geofence_type: 1 } })
      )?.category;
    expect(categoria(" Planta ")).toBe("Planta");
    // empty or not deployed yet: no category, never the properties or type
    expect(categoria("  ")).toBeNull();
    expect(categoria(null)).toBeNull();
  });

  it("tells StreamHub geofences from places created here", () => {
    expect(esDeStreamhub("streamhub-1156")).toBe(true);
    expect(esDeStreamhub("local-abc")).toBe(false);
    expect(esDeStreamhub(null)).toBe(false);
  });

  it("drops geofences without a usable shape", () => {
    expect(lugarDesdeGeofence(geocerca({ shape: null }))).toBeNull();
    expect(
      lugarDesdeGeofence(
        geocerca({
          shape: {
            type: "Polygon",
            coordinates: [
              [
                [-70, -33],
                [-70, -32],
                [-70, -33],
              ],
            ],
          },
        })
      )
    ).toBeNull();
  });

  it("reads the outer ring of the first polygon of a MultiPolygon, dropping Z", () => {
    const otro: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 0],
    ];
    expect(
      anilloExterior({
        type: "MultiPolygon",
        coordinates: [[anillo.map(([x, y]) => [x, y, 5])], [otro]],
      })
    ).toEqual(anillo);
  });

  it("parses the modulith's geofence, nulling a shape it cannot draw", () => {
    const base = {
      id: 7,
      code: "SCL",
      name: "SITRANS SANTIAGO",
      polygonType: "polygonal",
      category: "Puerto",
      properties: null,
    };
    expect(
      geocercaModulithSchema.parse({
        ...base,
        shape: { type: "Polygon", coordinates: [anillo] },
      }).shape?.type
    ).toBe("Polygon");
    expect(
      geocercaModulithSchema.parse({
        ...base,
        shape: { type: "Point", coordinates: [-70, -33] },
      }).shape
    ).toBeNull();
    expect(
      geocercaModulithSchema.safeParse({ ...base, id: "7", shape: null })
        .success
    ).toBe(false);
  });
});

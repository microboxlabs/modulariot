import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDirecciones, parsearSugerencias } from "./geocoding";

const respuesta = {
  features: [
    {
      id: "f1",
      geometry: { coordinates: [-70.65, -33.44] },
      properties: {
        mapbox_id: "m1",
        name: "Av. Libertador 1000",
        place_formatted: "Santiago, Región Metropolitana",
      },
    },
    { id: "sin-geometria", properties: { name: "x" } },
  ],
};

describe("geocoding", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses Mapbox v6 features into [lat, lon] suggestions", () => {
    expect(parsearSugerencias(respuesta)).toEqual([
      {
        id: "m1",
        nombre: "Av. Libertador 1000",
        contexto: "Santiago, Región Metropolitana",
        punto: [-33.44, -70.65],
      },
    ]);
    expect(parsearSugerencias(null)).toEqual([]);
  });

  it("searches in Chile, near the map centre", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(respuesta),
    });
    vi.stubGlobal("fetch", fetchMock);

    const xs = await buscarDirecciones("libertador", "tok", [-33, -70]);

    expect(xs).toHaveLength(1);
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/search/geocode/v6/forward");
    expect(url.searchParams.get("country")).toBe("cl");
    expect(url.searchParams.get("proximity")).toBe("-70,-33");
  });

  it("skips short queries and swallows errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await buscarDirecciones("ab", "tok")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await buscarDirecciones("abcd", "tok")).toEqual([]);
  });
});

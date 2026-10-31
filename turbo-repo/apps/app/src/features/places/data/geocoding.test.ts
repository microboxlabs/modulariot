import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buscarDirecciones,
  direccionDesdePunto,
  parsearSugerencias,
} from "./geocoding";
import { decodificar, recuperarCorto } from "./plus-code";

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
    expect(url.searchParams.get("permanent")).toBe("true");
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

  it("reverse-geocodes a map click to a street address", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          features: [
            {
              properties: {
                name: "Libertador",
                full_address: "Av. Libertador 1000, Santiago",
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await direccionDesdePunto([-33.44, -70.65], "tok")).toBe(
      "Av. Libertador 1000, Santiago"
    );
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/search/geocode/v6/reverse");
    expect(url.searchParams.get("permanent")).toBe("true");
    expect(url.searchParams.get("longitude")).toBe("-70.65");
    expect(url.searchParams.get("latitude")).toBe("-33.44");
  });

  it("goes straight to a full Plus Code, without calling Mapbox", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const [s] = await buscarDirecciones("47rfj9qr+7r", "tok");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(s).toMatchObject({
      nombre: "47RFJ9QR+7R",
      contexto: "Plus Code",
      punto: decodificar("47RFJ9QR+7R"),
    });
  });

  it("places a short Plus Code near the locality typed with it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(respuesta),
    });
    vi.stubGlobal("fetch", fetchMock);
    const [s] = await buscarDirecciones("J9QR+7R Santiago", "tok");
    // only the locality is geocoded
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("q")).toBe("Santiago");
    expect(s).toMatchObject({
      nombre: "J9QR+7R",
      contexto:
        "Plus Code · Av. Libertador 1000, Santiago, Región Metropolitana",
      punto: recuperarCorto("J9QR+7R", [-33.44, -70.65]),
    });
  });

  it("places a short Plus Code alone near the map centre", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const centro: [number, number] = [-33.45, -70.66];
    const [s] = await buscarDirecciones("J9QR+7R", "tok", centro);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(s?.punto).toEqual(recuperarCorto("J9QR+7R", centro));
    // without the map centre there is nothing to place it near
    expect(await buscarDirecciones("J9QR+7R", "tok", null)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { LatLon } from "../places.types";
import { ajustarRutaAMaximo, simplificarRuta } from "./simplify-route";

// ~1,1 m por paso de 0,00001°
const PASO = 0.00001;

/** Recta hacia el norte hasta la esquina, luego recta hacia el este. */
function esquina(antes: number, despues: number): LatLon[] {
  const norte: LatLon[] = Array.from({ length: antes }, (_, i) => [
    -33 + i * PASO,
    -70,
  ]);
  const vertice = norte.at(-1)!;
  const este: LatLon[] = Array.from({ length: despues }, (_, i) => [
    vertice[0],
    vertice[1] + (i + 1) * PASO,
  ]);
  return [...norte, ...este];
}

describe("simplificarRuta", () => {
  it("keeps only the ends of a straight road", () => {
    const recta: LatLon[] = Array.from({ length: 50 }, (_, i) => [
      -33 + i * PASO,
      -70,
    ]);
    expect(simplificarRuta(recta, 1)).toEqual([recta[0], recta[49]]);
  });

  it("keeps the corner of a turn", () => {
    const ruta = esquina(500, 500);
    expect(simplificarRuta(ruta, 1)).toEqual([ruta[0], ruta[499], ruta[999]]);
  });

  it("leaves short routes as they are", () => {
    const dos: LatLon[] = [
      [-33, -70],
      [-33.1, -70.1],
    ];
    expect(simplificarRuta(dos, 1)).toBe(dos);
  });
});

describe("ajustarRutaAMaximo", () => {
  it("does not touch a route that already fits", () => {
    const ruta = esquina(10, 10);
    expect(ajustarRutaAMaximo(ruta, 480)).toBe(ruta);
  });

  it("fits the limit without cutting the corner", () => {
    // 1000 points: taking one of every 3 would skip the corner (index 499)
    const ruta = esquina(500, 500);
    const corta = ajustarRutaAMaximo(ruta, 480);
    expect(corta.length).toBeLessThanOrEqual(480);
    expect(corta).toContainEqual(ruta[499]);
    expect(corta[0]).toEqual(ruta[0]);
    expect(corta.at(-1)).toEqual(ruta.at(-1));
  });

  it("uses the whole limit on a winding road, never just its ends", () => {
    // a zigzag with 2000 bends of the same size: keeps as many as fit
    const zigzag: LatLon[] = Array.from({ length: 2000 }, (_, i) => [
      -33 + i * PASO * 10,
      -70 + (i % 2) * PASO * 20,
    ]);
    const corta = ajustarRutaAMaximo(zigzag, 480);
    expect(corta).toHaveLength(480);
    expect(corta[0]).toEqual(zigzag[0]);
    expect(corta.at(-1)).toEqual(zigzag.at(-1));
  });

  it("drops the least important points first", () => {
    // a big corner and a 3 m bump: with room for 4, both stay; for 3, the bump goes
    const ruta: LatLon[] = [
      [-33, -70],
      [-33 + 100 * PASO, -70],
      [-33 + 200 * PASO, -70 + 3 * PASO],
      [-33 + 300 * PASO, -70],
      [-33 + 300 * PASO, -70 + 300 * PASO],
    ];
    expect(ajustarRutaAMaximo(ruta, 4)).toEqual([
      ruta[0],
      ruta[2],
      ruta[3],
      ruta[4],
    ]);
    expect(ajustarRutaAMaximo(ruta, 3)).toEqual([ruta[0], ruta[3], ruta[4]]);
  });
});

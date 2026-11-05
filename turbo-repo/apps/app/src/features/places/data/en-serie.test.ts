import { describe, expect, it } from "vitest";
import { enSerie } from "./en-serie";

describe("enSerie", () => {
  it("runs one at a time, in order, and keeps the results in order", async () => {
    const orden: string[] = [];
    let enCurso = 0;
    let maximo = 0;
    const r = await enSerie([30, 10, 20], async (ms, i) => {
      enCurso += 1;
      maximo = Math.max(maximo, enCurso);
      orden.push(`inicio ${i}`);
      await new Promise((res) => setTimeout(res, ms));
      orden.push(`fin ${i}`);
      enCurso -= 1;
      return ms * 2;
    });
    expect(r).toEqual([60, 20, 40]);
    expect(maximo).toBe(1);
    expect(orden).toEqual([
      "inicio 0",
      "fin 0",
      "inicio 1",
      "fin 1",
      "inicio 2",
      "fin 2",
    ]);
  });

  it("stops at the first failure", async () => {
    const vistos: number[] = [];
    await expect(
      enSerie([1, 2, 3], async (n) => {
        vistos.push(n);
        if (n === 2) throw new Error("no");
        return n;
      })
    ).rejects.toThrow("no");
    expect(vistos).toEqual([1, 2]);
  });

  it("returns an empty list for no items", async () => {
    expect(await enSerie([], async () => 1)).toEqual([]);
  });
});

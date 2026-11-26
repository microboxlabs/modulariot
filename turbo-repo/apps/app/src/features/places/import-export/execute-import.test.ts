import { describe, expect, it, vi } from "vitest";
import { ejecutarImport } from "./execute-import";
import type { FilaConUid, PlanImport } from "./import-conflicts";
import type { Guardados } from "../data/saved-places";
import type { Lugar } from "../places.types";

const lugar: Lugar = {
  place_id: "demo-place",
  name: "Demo",
  address: null,
  category: null,
  category_id: null,
  geometry_type: "circle",
  color: null,
  center: [0, 0],
  polygon: null,
  radius_m: 20,
  metadata: null,
  external_id: "DEMO",
  active_from: null,
  active_until: null,
};
const fila: FilaConUid = {
  uid: "demo-row",
  name: "Imported",
  lat: 0,
  lon: 0,
  geometry_type: "circle",
};
const plan: PlanImport = {
  crear: [],
  actualizarTrayectos: [],
  actualizar: [{ lugar, fila }],
  borrar: [{ lugar: { ...lugar, place_id: "other-place" }, fila }],
};
const datos: Guardados = { lugares: [lugar], trayectos: [], metadatos: {} };
const acciones = () => ({
  refrescar: vi.fn().mockResolvedValue(datos),
  crearLugar: vi.fn().mockResolvedValue(true),
  guardarTrayecto: vi.fn().mockResolvedValue(true),
  reemplazarLugar: vi.fn().mockResolvedValue(true),
  quitarLugar: vi.fn().mockResolvedValue(true),
});

describe("import writes", () => {
  it("keeps replaced places when their replacement fails", async () => {
    const api = acciones();
    api.reemplazarLugar.mockResolvedValue(false);
    const resultado = await ejecutarImport(plan, api);
    expect(api.quitarLugar).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      actualizadas: 0,
      reemplazadas: 0,
      rechazadas: 2,
    });
  });

  it("only deletes places belonging to successful rows in a mixed batch", async () => {
    const api = acciones();
    api.reemplazarLugar
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const otraFila = { ...fila, uid: "second-row" };
    await ejecutarImport(
      {
        ...plan,
        actualizar: [...plan.actualizar, { lugar, fila: otraFila }],
        borrar: [...plan.borrar, { lugar, fila: otraFila }],
      },
      api
    );
    expect(api.quitarLugar).toHaveBeenCalledExactlyOnceWith(lugar, datos);
  });

  it("uses the saved parent and children from every preceding write", async () => {
    const api = acciones();
    const edited = { ...datos, lugares: [{ ...lugar, name: "Edited parent" }] };
    const firstRemoval = { ...edited, lugares: [] };
    api.refrescar
      .mockResolvedValueOnce(datos)
      .mockResolvedValueOnce(edited)
      .mockResolvedValueOnce(firstRemoval)
      .mockResolvedValue(datos);
    await ejecutarImport(
      {
        ...plan,
        actualizar: [
          ...plan.actualizar,
          { lugar, fila: { ...fila, uid: "inner-row" } },
        ],
        borrar: [...plan.borrar, ...plan.borrar],
      },
      api
    );
    expect(api.reemplazarLugar.mock.calls.map((args) => args[2])).toEqual([
      datos,
      edited,
    ]);
    expect(api.quitarLugar.mock.calls.map((args) => args[1])).toEqual([
      firstRemoval,
      datos,
    ]);
  });

  it("stops before another write or deletion if refreshing fails", async () => {
    const api = acciones();
    api.refrescar
      .mockResolvedValueOnce(datos)
      .mockRejectedValueOnce(new Error("offline"));
    await expect(
      ejecutarImport(
        { ...plan, actualizar: [...plan.actualizar, ...plan.actualizar] },
        api
      )
    ).rejects.toThrow("offline");
    expect(api.reemplazarLugar).toHaveBeenCalledTimes(1);
    expect(api.quitarLugar).not.toHaveBeenCalled();
  });
});

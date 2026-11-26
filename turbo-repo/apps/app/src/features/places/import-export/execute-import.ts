import type { Guardados } from "../data/saved-places";
import type { Lugar } from "../places.types";
import { filaEsLinea, type FilaImport } from "./import-places";
import type { PlanImport } from "./import-conflicts";

type AccionesImport = {
  refrescar: () => Promise<Guardados>;
  crearLugar: (fila: FilaImport) => Promise<boolean>;
  guardarTrayecto: (
    fila: FilaImport,
    id: string | null,
    datos: Guardados
  ) => Promise<boolean>;
  reemplazarLugar: (
    lugar: Lugar,
    fila: FilaImport,
    datos: Guardados
  ) => Promise<boolean>;
  quitarLugar: (lugar: Lugar, datos: Guardados) => Promise<boolean>;
};

/** Each dependent write uses the server state left by the previous write. */
export async function ejecutarImport(
  plan: PlanImport,
  acciones: AccionesImport
) {
  let datos = await acciones.refrescar();
  const resultado = {
    creadas: 0,
    actualizadas: 0,
    reemplazadas: 0,
    locales: 0,
    rechazadas: 0,
  };
  const exitos = new Set<string>();
  const registrar = async (
    ok: boolean,
    campo: "creadas" | "actualizadas" | "reemplazadas"
  ) => {
    if (ok) {
      resultado[campo]++;
      // A failed refresh stops the batch before another write can restore old data.
      datos = await acciones.refrescar();
    } else resultado.rechazadas++;
    return ok;
  };
  for (const fila of plan.crear) {
    const ok = filaEsLinea(fila)
      ? await acciones.guardarTrayecto(fila, null, datos)
      : await acciones.crearLugar(fila);
    await registrar(ok, "creadas");
  }
  for (const { trayecto, fila } of plan.actualizarTrayectos) {
    if (
      await registrar(
        await acciones.guardarTrayecto(fila, trayecto.trayecto_id, datos),
        "actualizadas"
      )
    )
      exitos.add(fila.uid);
  }
  for (const { lugar, fila } of plan.actualizar) {
    if (
      await registrar(
        await acciones.reemplazarLugar(lugar, fila, datos),
        "actualizadas"
      )
    )
      exitos.add(fila.uid);
  }
  for (const { lugar, fila } of plan.borrar) {
    // Only the row that successfully replaced this place may delete it.
    const ok =
      exitos.has(fila.uid) && (await acciones.quitarLugar(lugar, datos));
    await registrar(ok, "reemplazadas");
  }
  return resultado;
}

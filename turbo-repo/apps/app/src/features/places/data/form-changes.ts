// ¿El formulario abierto cambió desde que se abrió? Decide si cerrarlo pide
// confirmación. Solo cuenta lo que se guarda: el historial de deshacer, la
// búsqueda de "Posicionar geocerca" o la interior seleccionada no.
import type { FormLugar, FormTrayecto } from "../places.types";

const SOLO_LUGAR_UI = new Set<string>([
  "pasado",
  "futuro",
  "busqueda",
  "ubicadoEn",
  "innerEditId",
]);
// `vias` son los nombres de calles que trae Directions (no los edita nadie)
const SOLO_TRAYECTO_UI = new Set<string>(["pasado", "futuro", "vias"]);

/** JSON con las claves en orden y sin las de solo interfaz. */
function firma(o: Record<string, unknown>, ignorar: Set<string>): string {
  const claves = Object.keys(o)
    .filter((k) => !ignorar.has(k))
    .sort((a, b) => a.localeCompare(b));
  return JSON.stringify(claves.map((k) => [k, o[k]]));
}

export function cambioLugar(inicial: FormLugar, actual: FormLugar): boolean {
  return firma(inicial, SOLO_LUGAR_UI) !== firma(actual, SOLO_LUGAR_UI);
}

/**
 * Un punto ya ubicado se rotula solo (dirección por geocodificación): su
 * texto no cuenta como cambio; el de un punto sin ubicar sí (se escribió).
 */
const sinRotulos = (t: FormTrayecto) => ({
  ...t,
  recorrido: t.recorrido.map((p) => (p.punto ? { ...p, texto: "" } : p)),
});

export function cambioTrayecto(
  inicial: FormTrayecto,
  actual: FormTrayecto
): boolean {
  return (
    firma(sinRotulos(inicial), SOLO_TRAYECTO_UI) !==
    firma(sinRotulos(actual), SOLO_TRAYECTO_UI)
  );
}

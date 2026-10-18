// Versionado de geocercas y trayectos, con el mismo sistema que los síntomas
// en Ajustes: versión semántica (mayor.menor.parche), cada cambio del
// formulario trae su tamaño y la versión recomendada sale del mayor de ellos.
import type { VersionBump } from "@/features/symptoms/maintainer/maintainer-api";
import type {
  FormLugar,
  FormTrayecto,
  InnerGeofence,
  LatLon,
  Parada,
} from "../places.types";

export type { VersionBump };
export { nextVersion } from "@/features/symptoms/maintainer/publish-dialog";

/** Lo que nunca se versionó (creado antes o recién creado) está en esta. */
export const VERSION_INICIAL = "1.0.0";

export type CambioVersion = { texto: string; bump: VersionBump };

const ORDEN: VersionBump[] = ["PATCH", "MINOR", "MAJOR"];

/** El tamaño mayor entre los cambios; sin cambios, ninguno. */
export function bumpRecomendado(cambios: CambioVersion[]): VersionBump | null {
  let max = -1;
  for (const c of cambios) max = Math.max(max, ORDEN.indexOf(c.bump));
  return ORDEN[max] ?? null;
}

const EPS = 1e-7;
const mismoPunto = (a: LatLon | null, b: LatLon | null): boolean => {
  if (!a || !b) return a === b;
  return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
};
const mismosPuntos = (a: LatLon[], b: LatLon[]): boolean =>
  a.length === b.length && a.every((p, i) => mismoPunto(p, b[i] ?? null));
const mismoTexto = (a: string, b: string) => a.trim() === b.trim();
const porTexto = (a: string, b: string) => a.localeCompare(b);
const mismaLista = (a: string[], b: string[]) =>
  a.length === b.length &&
  [...a].sort(porTexto).join("|") === [...b].sort(porTexto).join("|");
const citar = (s: string) => (s.trim() ? `«${s.trim()}»` : "vacío");

/** "2 agregadas, 1 quitada" entre dos listas de códigos. */
function diferenciaLista(antes: string[], despues: string[]): string {
  const agregadas = despues.filter((c) => !antes.includes(c)).length;
  const quitadas = antes.filter((c) => !despues.includes(c)).length;
  const partes: string[] = [];
  if (agregadas)
    partes.push(`${agregadas} agregada${agregadas > 1 ? "s" : ""}`);
  if (quitadas) partes.push(`${quitadas} quitada${quitadas > 1 ? "s" : ""}`);
  return partes.join(", ");
}

function cambioTexto(
  etiqueta: string,
  antes: string,
  despues: string,
  bump: VersionBump
): CambioVersion[] {
  if (mismoTexto(antes, despues)) return [];
  return [{ texto: `${etiqueta}: ${citar(antes)} → ${citar(despues)}`, bump }];
}

const textoVigencia = (desde: string, hasta: string) =>
  desde || hasta ? `${desde || "…"} a ${hasta || "…"}` : "sin vigencia";

const textoGeom = (g: "circle" | "polygon") =>
  g === "polygon" ? "polígono" : "círculo";

type FormaGeocerca = Pick<
  InnerGeofence,
  "geom" | "lat" | "lon" | "radius_m" | "vertices"
>;

/** Cambios de la forma de una geocerca (padre o interior): todos MAYOR. */
function cambiosForma(
  antes: FormaGeocerca,
  despues: FormaGeocerca,
  de: string
): CambioVersion[] {
  if (antes.geom !== despues.geom) {
    return [
      {
        texto: `Tipo de ${de}: ${textoGeom(antes.geom)} → ${textoGeom(despues.geom)}`,
        bump: "MAJOR",
      },
    ];
  }
  if (despues.geom === "polygon") {
    if (mismosPuntos(antes.vertices, despues.vertices)) return [];
    const n = antes.vertices.length;
    const m = despues.vertices.length;
    const detalle = n === m ? "vértices movidos" : `${n} → ${m} vértices`;
    return [{ texto: `Forma de ${de} (${detalle})`, bump: "MAJOR" }];
  }
  const out: CambioVersion[] = [];
  const centroAntes: LatLon | null =
    antes.lat != null && antes.lon != null ? [antes.lat, antes.lon] : null;
  const centroDespues: LatLon | null =
    despues.lat != null && despues.lon != null
      ? [despues.lat, despues.lon]
      : null;
  if (!mismoPunto(centroAntes, centroDespues))
    out.push({ texto: `Centro de ${de} movido`, bump: "MAJOR" });
  if (antes.radius_m !== despues.radius_m)
    out.push({
      texto: `Radio de ${de}: ${antes.radius_m} m → ${despues.radius_m} m`,
      bump: "MAJOR",
    });
  return out;
}

/** Geocercas interiores: agregar o quitar es MENOR; cambiar su forma, MAYOR. */
function cambiosInteriores(
  antes: InnerGeofence[],
  despues: InnerGeofence[]
): CambioVersion[] {
  const out: CambioVersion[] = [];
  const porId = new Map(antes.map((i) => [i.id, i]));
  const siguen = new Set(despues.map((i) => i.id));
  for (const i of despues) {
    const prev = porId.get(i.id);
    const nombre = citar(i.name);
    if (!prev) {
      out.push({
        texto: `Geocerca interior agregada: ${nombre}`,
        bump: "MINOR",
      });
      continue;
    }
    out.push(...cambiosForma(prev, i, `la geocerca interior ${nombre}`));
    if (!mismoTexto(prev.name, i.name))
      out.push({
        texto: `Geocerca interior renombrada: ${citar(prev.name)} → ${nombre}`,
        bump: "PATCH",
      });
    if (prev.color !== i.color)
      out.push({
        texto: `Color de la geocerca interior ${nombre}`,
        bump: "PATCH",
      });
  }
  for (const i of antes) {
    if (!siguen.has(i.id))
      out.push({
        texto: `Geocerca interior quitada: ${citar(i.name)}`,
        bump: "MINOR",
      });
  }
  return out;
}

const filasMetadata = (f: FormLugar) =>
  f.metadata
    .filter((r) => r.k.trim())
    .map((r) => `${r.k.trim()}=${r.v.trim()}`);

/**
 * Qué cambió en una geocerca entre que se abrió y se guarda.
 * MAYOR: su forma (lo que detecta); MENOR: categorías, vigencia, interiores;
 * PARCHE: nombre, color, ícono y demás datos.
 */
export function cambiosLugar(
  antes: FormLugar,
  despues: FormLugar
): CambioVersion[] {
  const out: CambioVersion[] = [
    ...cambiosForma(antes, despues, "la geocerca"),
    ...cambiosInteriores(antes.inners, despues.inners),
  ];
  if (!mismaLista(antes.categorias, despues.categorias))
    out.push({
      texto: `Categorías: ${diferenciaLista(antes.categorias, despues.categorias)}`,
      bump: "MINOR",
    });
  if (antes.category_id !== despues.category_id)
    out.push({ texto: "Categoría del lugar cambiada", bump: "MINOR" });
  const vigAntes = textoVigencia(antes.active_from, antes.active_until);
  const vigDespues = textoVigencia(despues.active_from, despues.active_until);
  if (vigAntes !== vigDespues)
    out.push({ texto: `Vigencia: ${vigAntes} → ${vigDespues}`, bump: "MINOR" });
  out.push(
    ...cambioTexto("Nombre", antes.name, despues.name, "PATCH"),
    ...cambioTexto("Dirección", antes.address, despues.address, "PATCH"),
    ...cambioTexto(
      "ID externo",
      antes.external_id,
      despues.external_id,
      "PATCH"
    )
  );
  if (antes.color !== despues.color)
    out.push({ texto: "Color cambiado", bump: "PATCH" });
  if (antes.icon !== despues.icon)
    out.push({ texto: "Ícono cambiado", bump: "PATCH" });
  if (!mismaLista(filasMetadata(antes), filasMetadata(despues)))
    out.push({ texto: "Datos adicionales modificados", bump: "PATCH" });
  return out;
}

const ubicados = (t: FormTrayecto): Parada[] =>
  t.recorrido.filter((p) => p.punto);

/** El recorrido: origen, destino o puntos intermedios distintos son MAYOR. */
function cambiosRecorrido(
  antes: FormTrayecto,
  despues: FormTrayecto
): CambioVersion[] {
  const a = ubicados(antes);
  const b = ubicados(despues);
  const out: CambioVersion[] = [];
  if (!mismoPunto(a[0]?.punto ?? null, b[0]?.punto ?? null))
    out.push({ texto: "Origen (A) movido", bump: "MAJOR" });
  if (!mismoPunto(a.at(-1)?.punto ?? null, b.at(-1)?.punto ?? null))
    out.push({ texto: "Destino (B) movido", bump: "MAJOR" });
  const midA = a.slice(1, -1);
  const midB = b.slice(1, -1);
  if (midA.length !== midB.length) {
    out.push({
      texto: `Puntos intermedios: ${midA.length} → ${midB.length}`,
      bump: "MAJOR",
    });
    return out;
  }
  const movidos = midA.filter(
    (p, i) => !mismoPunto(p.punto, midB[i]?.punto ?? null)
  ).length;
  if (movidos)
    out.push({
      texto: `Puntos intermedios movidos: ${movidos}`,
      bump: "MAJOR",
    });
  // mismos puntos: lo que cambia es qué son (parada o desvío) o su categoría
  const tipos = midA.filter(
    (p, i) => (p.tipo ?? "parada") !== (midB[i]?.tipo ?? "parada")
  ).length;
  if (tipos)
    out.push({
      texto: `Parada o desvío cambiado en ${tipos} punto${tipos > 1 ? "s" : ""}`,
      bump: "MINOR",
    });
  const cats = midA.filter(
    (p, i) => (p.categoria ?? "") !== (midB[i]?.categoria ?? "")
  ).length;
  if (cats)
    out.push({
      texto: `Categoría cambiada en ${cats} punto${cats > 1 ? "s" : ""}`,
      bump: "MINOR",
    });
  return out;
}

/**
 * Qué cambió en un trayecto entre que se abrió y se guarda.
 * MAYOR: el recorrido, el tipo de ruta o su ancho; MENOR: categorías y qué
 * es cada punto; PARCHE: nombre, ícono e ID externo.
 */
export function cambiosTrayecto(
  antes: FormTrayecto,
  despues: FormTrayecto
): CambioVersion[] {
  const out = cambiosRecorrido(antes, despues);
  if (antes.kind !== despues.kind)
    out.push({
      texto: `Tipo de ruta: ${antes.kind} → ${despues.kind}`,
      bump: "MAJOR",
    });
  if (antes.width_m !== despues.width_m)
    out.push({
      texto: `Ancho: ${antes.width_m} m → ${despues.width_m} m`,
      bump: "MAJOR",
    });
  if (antes.ajustado !== despues.ajustado)
    out.push({
      texto: despues.ajustado
        ? "Ruta ajustada a las calles"
        : "Ruta ya no ajustada a las calles",
      bump: "MAJOR",
    });
  if (!mismaLista(antes.categorias, despues.categorias))
    out.push({
      texto: `Categorías: ${diferenciaLista(antes.categorias, despues.categorias)}`,
      bump: "MINOR",
    });
  out.push(
    ...cambioTexto("Nombre", antes.name, despues.name, "PATCH"),
    ...cambioTexto(
      "ID externo",
      antes.external_id,
      despues.external_id,
      "PATCH"
    )
  );
  if (antes.icon !== despues.icon)
    out.push({ texto: "Ícono cambiado", bump: "PATCH" });
  return out;
}

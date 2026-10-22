// Gestor de conflictos de la importación: cada fila importada se compara con
// los lugares guardados y con las filas anteriores del mismo import.
//
// - Total: la misma forma, con exactamente los mismos números en cada punto
//   (círculo: mismo centro y radio).
// - Parcial: las formas se tocan (un punto dentro de la otra o lados que se
//   cruzan) sin ser iguales.
//
// Por fila se decide: "existente" (queda lo que ya estaba), "nuevo" (gana la
// importada: actualiza el lugar guardado o descarta la otra fila) o "ambos"
// (solo en parciales: se quedan los dos).
import type { FilaImport } from "./import-places";
import type { LatLon, Lugar, TipoPunto, Trayecto } from "../places.types";

export type FilaConUid = FilaImport & { uid: string };

export type Forma =
  | { tipo: "circulo"; lat: number; lon: number; radio: number }
  | { tipo: "poligono"; vertices: LatLon[] }
  /** Trayecto: su camino (solo para dibujarlo y encuadrarlo). */
  | { tipo: "linea"; puntos: LatLon[] };

export type ConflictoImport = {
  tipo: "total" | "parcial";
  con:
    | { tipo: "lugar"; lugar: Lugar }
    | { tipo: "trayecto"; trayecto: Trayecto }
    | { tipo: "fila"; uid: string; name: string };
};

export type DecisionImport = "existente" | "nuevo" | "ambos";

/** Id de aquello con que choca (lugar, trayecto u otra fila). */
export function idConflicto(c: ConflictoImport): string {
  if (c.con.tipo === "lugar") return c.con.lugar.place_id;
  if (c.con.tipo === "trayecto") return c.con.trayecto.trayecto_id;
  return c.con.uid;
}

export function nombreConflicto(c: ConflictoImport): string {
  if (c.con.tipo === "lugar") return c.con.lugar.name;
  if (c.con.tipo === "trayecto") return c.con.trayecto.name;
  return c.con.name;
}

const RADIO_DEF = 20;
const LADOS_CIRCULO = 48;

/** Círculo como anillo GeoJSON [lon, lat] cerrado (lo que dibuja el mapa). */
export function anilloCirculo(
  lat: number,
  lon: number,
  radioM: number
): [number, number][] {
  const pts: [number, number][] = [];
  const dLat = radioM / 111_320;
  const dLon = radioM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= LADOS_CIRCULO; i++) {
    const a = (2 * Math.PI * i) / LADOS_CIRCULO;
    pts.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return pts;
}

export function formaDeFila(f: FilaImport): Forma {
  if (f.geometry_type === "line") {
    return { tipo: "linea", puntos: f.points ?? f.waypoints ?? [] };
  }
  if (f.geometry_type === "polygon" && (f.vertices?.length ?? 0) >= 3) {
    return { tipo: "poligono", vertices: f.vertices ?? [] };
  }
  return {
    tipo: "circulo",
    lat: f.lat,
    lon: f.lon,
    radio: f.radius_m ?? RADIO_DEF,
  };
}

export function formaDeLugar(l: Lugar): Forma | null {
  if (l.polygon && l.polygon.length >= 3) {
    return { tipo: "poligono", vertices: l.polygon };
  }
  if (!l.center) return null;
  return {
    tipo: "circulo",
    lat: l.center[0],
    lon: l.center[1],
    radio: l.radius_m ?? RADIO_DEF,
  };
}

/** Vértices [lat, lon] sin el punto de cierre repetido. */
function sinCierre(vs: LatLon[]): LatLon[] {
  const a = vs[0];
  const b = vs.at(-1);
  if (vs.length > 1 && a?.[0] === b?.[0] && a?.[1] === b?.[1]) {
    return vs.slice(0, -1);
  }
  return vs;
}

export const formaDeTrayecto = (t: Trayecto): Forma => ({
  tipo: "linea",
  puntos: t.points,
});

/** Contorno de la forma como vértices [lat, lon] (un trayecto: su camino). */
export function contorno(f: Forma): LatLon[] {
  if (f.tipo === "linea") return f.puntos;
  if (f.tipo === "poligono") return sinCierre(f.vertices);
  return anilloCirculo(f.lat, f.lon, f.radio)
    .slice(0, -1)
    .map(([lo, la]) => [la, lo] as LatLon);
}

const clave = ([la, lo]: LatLon) => `${la},${lo}`;

/** Exactamente los mismos números en cada punto (el orden no importa). */
/** Orden de texto estable (no el de código de caracteres por defecto). */
const porTexto = (a: string, b: string) => a.localeCompare(b);

export function mismaForma(a: Forma, b: Forma): boolean {
  if (a.tipo === "circulo" && b.tipo === "circulo") {
    return a.lat === b.lat && a.lon === b.lon && a.radio === b.radio;
  }
  if (a.tipo !== "poligono" || b.tipo !== "poligono") return false;
  const va = sinCierre(a.vertices).map(clave).sort(porTexto);
  const vb = sinCierre(b.vertices).map(clave).sort(porTexto);
  return va.length === vb.length && va.every((k, i) => k === vb[i]);
}

type Caja = { minLa: number; maxLa: number; minLo: number; maxLo: number };

function cajaDe(pts: LatLon[]): Caja {
  let minLa = Infinity;
  let maxLa = -Infinity;
  let minLo = Infinity;
  let maxLo = -Infinity;
  for (const [la, lo] of pts) {
    minLa = Math.min(minLa, la);
    maxLa = Math.max(maxLa, la);
    minLo = Math.min(minLo, lo);
    maxLo = Math.max(maxLo, lo);
  }
  return { minLa, maxLa, minLo, maxLo };
}

const cajasSeTocan = (a: Caja, b: Caja) =>
  a.minLa <= b.maxLa &&
  b.minLa <= a.maxLa &&
  a.minLo <= b.maxLo &&
  b.minLo <= a.maxLo;

/** Punto dentro del polígono (rayo horizontal). */
export function puntoEnPoligono([la, lo]: LatLon, poly: LatLon[]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [lai, loi] = poly[i]!;
    const [laj, loj] = poly[j]!;
    const cruza =
      lai > la !== laj > la &&
      lo < ((loj - loi) * (la - lai)) / (laj - lai) + loi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

const orient = (a: LatLon, b: LatLon, c: LatLon) =>
  Math.sign((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]));

function segmentosCruzan(a: LatLon, b: LatLon, c: LatLon, d: LatLon) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  // prueba de orientación: el orden de los puntos cambia a propósito
  const o3 = orient(c, d, a); // NOSONAR (typescript:S2234)
  const o4 = orient(c, d, b);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0;
}

function ladosCruzan(pa: LatLon[], pb: LatLon[]): boolean {
  for (let i = 0; i < pa.length; i++) {
    const a1 = pa[i]!;
    const a2 = pa[(i + 1) % pa.length]!;
    for (let j = 0; j < pb.length; j++) {
      if (segmentosCruzan(a1, a2, pb[j]!, pb[(j + 1) % pb.length]!)) {
        return true;
      }
    }
  }
  return false;
}

/** Las formas se tocan: algún punto dentro de la otra o lados que se cruzan. */
export function seTocan(a: Forma, b: Forma): boolean {
  const pa = contorno(a);
  const pb = contorno(b);
  if (pa.length < 3 || pb.length < 3) return false;
  if (!cajasSeTocan(cajaDe(pa), cajaDe(pb))) return false;
  return (
    pa.some((p) => puntoEnPoligono(p, pb)) ||
    pb.some((p) => puntoEnPoligono(p, pa)) ||
    ladosCruzan(pa, pb)
  );
}

/** Recorrido de un trayecto para compararlo: A → B con el tipo de cada punto. */
type Recorrido = { waypoints: LatLon[]; tipos: TipoPunto[] };

const recorridoDeFila = (f: FilaImport): Recorrido => ({
  waypoints: f.waypoints ?? [],
  tipos: f.tipos_puntos ?? [],
});

const recorridoDeTrayecto = (t: Trayecto): Recorrido => ({
  waypoints: t.waypoints?.length ? t.waypoints : t.points,
  tipos: t.tipos_puntos ?? [],
});

/**
 * Mismo trayecto: mismo inicio y fin y, en el medio, exactamente los mismos
 * puntos en el mismo orden, con el mismo tipo (parada o desvío).
 */
export function mismoRecorrido(a: Recorrido, b: Recorrido): boolean {
  if (a.waypoints.length !== b.waypoints.length) return false;
  return a.waypoints.every((p, i) => {
    const q = b.waypoints[i]!;
    const tipoA = a.tipos[i] ?? "parada";
    const tipoB = b.tipos[i] ?? "parada";
    return p[0] === q[0] && p[1] === q[1] && tipoA === tipoB;
  });
}

function tipoConflicto(a: Forma, b: Forma): ConflictoImport["tipo"] | null {
  if (mismaForma(a, b)) return "total";
  return seTocan(a, b) ? "parcial" : null;
}

/**
 * Conflictos de cada fila (por uid). Una geocerca se compara con los lugares
 * guardados y las geocercas anteriores del import; un trayecto, con los
 * trayectos guardados y los anteriores del import (solo conflicto total:
 * el mismo recorrido). La fila posterior lleva el conflicto.
 */
export function detectarConflictos(
  filas: FilaConUid[],
  lugares: Lugar[],
  trayectos: Trayecto[] = []
): Map<string, ConflictoImport[]> {
  const guardados = lugares.flatMap((l) => {
    const forma = formaDeLugar(l);
    return forma ? [{ l, forma }] : [];
  });
  const formas = filas.map(formaDeFila);
  const out = new Map<string, ConflictoImport[]>();
  filas.forEach((fila, i) => {
    const cs =
      fila.geometry_type === "line"
        ? conflictosDeTrayecto(fila, filas.slice(0, i), trayectos)
        : conflictosDeGeocerca(formas, i, filas, guardados);
    if (cs.length) out.set(fila.uid, cs);
  });
  return out;
}

function conflictosDeGeocerca(
  formas: Forma[],
  i: number,
  filas: FilaConUid[],
  guardados: { l: Lugar; forma: Forma }[]
): ConflictoImport[] {
  const forma = formas[i]!;
  const cs: ConflictoImport[] = [];
  for (const { l, forma: otra } of guardados) {
    const tipo = tipoConflicto(forma, otra);
    if (tipo) cs.push({ tipo, con: { tipo: "lugar", lugar: l } });
  }
  for (let j = 0; j < i; j++) {
    const otra = filas[j]!;
    if (otra.geometry_type === "line") continue;
    const tipo = tipoConflicto(forma, formas[j]!);
    if (tipo) {
      cs.push({ tipo, con: { tipo: "fila", uid: otra.uid, name: otra.name } });
    }
  }
  return cs;
}

function conflictosDeTrayecto(
  fila: FilaConUid,
  anteriores: FilaConUid[],
  trayectos: Trayecto[]
): ConflictoImport[] {
  const r = recorridoDeFila(fila);
  const cs: ConflictoImport[] = [];
  for (const t of trayectos) {
    if (mismoRecorrido(r, recorridoDeTrayecto(t))) {
      cs.push({ tipo: "total", con: { tipo: "trayecto", trayecto: t } });
    }
  }
  for (const otra of anteriores) {
    if (otra.geometry_type !== "line") continue;
    if (mismoRecorrido(r, recorridoDeFila(otra))) {
      cs.push({
        tipo: "total",
        con: { tipo: "fila", uid: otra.uid, name: otra.name },
      });
    }
  }
  return cs;
}

/** Total si alguno es total; si no, parcial. */
export const gravedad = (cs: ConflictoImport[]): ConflictoImport["tipo"] =>
  cs.some((c) => c.tipo === "total") ? "total" : "parcial";

/** "Ambos" solo cuando ningún conflicto es total. */
export function opcionesDecision(cs: ConflictoImport[]): DecisionImport[] {
  return gravedad(cs) === "total"
    ? ["existente", "nuevo"]
    : ["existente", "nuevo", "ambos"];
}

export function decisionPorDefecto(cs: ConflictoImport[]): DecisionImport {
  return gravedad(cs) === "total" ? "existente" : "ambos";
}

/** Decisión vigente de una fila (la elegida, si sigue siendo válida). */
export function decisionDe(
  cs: ConflictoImport[],
  elegida: DecisionImport | undefined
): DecisionImport {
  return elegida && opcionesDecision(cs).includes(elegida)
    ? elegida
    : decisionPorDefecto(cs);
}

export type PlanImport = {
  crear: FilaConUid[];
  /** "Usar nuevo" contra un lugar guardado: se actualiza con la fila. */
  actualizar: { lugar: Lugar; fila: FilaConUid }[];
  /** "Usar nuevo" contra un trayecto guardado: se actualiza con la fila. */
  actualizarTrayectos: { trayecto: Trayecto; fila: FilaConUid }[];
  /** Otros lugares guardados que la fila nueva reemplaza. */
  borrar: Lugar[];
};

type Decision = (uid: string) => DecisionImport | null;

/**
 * Filas que no se importan: las que eligen lo existente y las que pierden
 * contra otra fila que eligió lo nuevo.
 */
function filasFuera(
  filas: FilaConUid[],
  conflictos: Map<string, ConflictoImport[]>,
  decision: Decision
): Set<string> {
  const fuera = new Set<string>();
  for (const f of filas) {
    const d = decision(f.uid);
    if (d === "existente") fuera.add(f.uid);
    if (d !== "nuevo") continue;
    for (const c of conflictos.get(f.uid) ?? []) {
      if (c.con.tipo === "fila") fuera.add(c.con.uid);
    }
  }
  return fuera;
}

/** Lo que se va armando: qué se actualiza, qué se borra y qué ya se usó. */
type Reemplazos = {
  actualizar: PlanImport["actualizar"];
  actualizarTrayectos: PlanImport["actualizarTrayectos"];
  borrar: Map<string, Lugar>;
  /** Guardados que ya reemplaza alguna fila. */
  usados: Set<string>;
  /** Filas que ya actualizan algo (no se crean aparte). */
  actualizadas: Set<string>;
};

/** El mismo recorrido guardado: se actualiza (uno por fila). */
function reemplazarTrayecto(f: FilaConUid, t: Trayecto, r: Reemplazos) {
  const id = t.trayecto_id;
  if (r.usados.has(id) || r.actualizadas.has(f.uid)) return;
  r.usados.add(id);
  r.actualizarTrayectos.push({ trayecto: t, fila: f });
  r.actualizadas.add(f.uid);
}

/** Un lugar guardado que la fila toca: el primero se actualiza, el resto se borra. */
function reemplazarLugar(f: FilaConUid, l: Lugar, r: Reemplazos) {
  const id = l.place_id;
  if (r.usados.has(id)) return;
  r.usados.add(id);
  if (r.actualizadas.has(f.uid)) {
    r.borrar.set(id, l);
    return;
  }
  r.actualizar.push({ lugar: l, fila: f });
  r.actualizadas.add(f.uid);
}

/** Qué hacer al importar, según las decisiones de cada fila. */
export function planImport(
  filas: FilaConUid[],
  conflictos: Map<string, ConflictoImport[]>,
  decisiones: Record<string, DecisionImport>
): PlanImport {
  const decision: Decision = (uid) => {
    const cs = conflictos.get(uid);
    return cs ? decisionDe(cs, decisiones[uid]) : null;
  };
  const fuera = filasFuera(filas, conflictos, decision);
  // las que eligen lo nuevo reemplazan a lo guardado con que chocan
  const r: Reemplazos = {
    actualizar: [],
    actualizarTrayectos: [],
    borrar: new Map(),
    usados: new Set(),
    actualizadas: new Set(),
  };
  const ganadoras = filas.filter(
    (f) => !fuera.has(f.uid) && decision(f.uid) === "nuevo"
  );
  for (const f of ganadoras) {
    for (const c of conflictos.get(f.uid) ?? []) {
      if (c.con.tipo === "trayecto") reemplazarTrayecto(f, c.con.trayecto, r);
      else if (c.con.tipo === "lugar") reemplazarLugar(f, c.con.lugar, r);
    }
  }
  return {
    crear: filas.filter((f) => !fuera.has(f.uid) && !r.actualizadas.has(f.uid)),
    actualizar: r.actualizar,
    actualizarTrayectos: r.actualizarTrayectos,
    borrar: [...r.borrar.values()],
  };
}

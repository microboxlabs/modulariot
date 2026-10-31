// Borrador del formulario abierto (lugar o trayecto) en localStorage: al
// recargar la página se puede seguir donde se quedó. Cada mapa (vista
// geográfica, mapa del viaje) guarda el suyo. Se borra al cerrar o guardar.
import { z } from "zod";
import { placesStorageKey } from "./storage-key";
import {
  FORM_VACIO,
  TRAY_VACIO,
  type FormLugar,
  type FormTrayecto,
  type LatLon,
  type PasoLugar,
  type PasoTrayecto,
} from "../places.types";

const PREFIJO = "miot.places.draft.v1.";
/** Un borrador más viejo que esto ya no se ofrece. */
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000;

export type AmbitoBorrador = "geografico" | "viaje";

export type BorradorLugar = {
  tipo: "lugar";
  form: FormLugar;
  paso: PasoLugar;
  /** Cómo estaba al abrirlo (para listar los cambios de la versión). */
  original: FormLugar | null;
  /** Cómo estaba al abrirlo, nuevo o no (¿hay cambios sin guardar?). */
  inicial: FormLugar | null;
};

export type BorradorTrayecto = {
  tipo: "trayecto";
  tray: FormTrayecto;
  paso: PasoTrayecto;
  original: FormTrayecto | null;
  inicial: FormTrayecto | null;
  pathAjustado: LatLon[] | null;
};

export type Borrador = BorradorLugar | BorradorTrayecto;

const finite = z.number().finite();
const latLon = z.tuple([finite, finite]);
const latLons = z.array(latLon);
const geometry = z.enum(["circle", "polygon"]);
const polyBase = z.enum(["libre", "rect", "tri"]);
const innerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    geom: geometry,
    lat: finite.nullable(),
    lon: finite.nullable(),
    radius_m: finite,
    vertices: latLons,
    cerrado: z.boolean(),
    color: z.string(),
    polyBase: z.enum(["libre", "rect", "tri", "cuadro"]).optional(),
    rectVinculado: z.boolean().optional(),
    rect_w_m: finite.optional(),
    rect_h_m: finite.optional(),
  })
  .passthrough();
const pointSchema = z
  .object({
    id: z.string(),
    texto: z.string(),
    punto: latLon.nullable(),
    tipo: z.enum(["parada", "desvio"]).optional(),
    categoria: z.string().optional(),
  })
  .passthrough();
const points = z.array(pointSchema);
// Partial schemas keep older drafts readable; unknown future fields are retained.
const placeSchema = z
  .object({
    place_id: z.string().nullable(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
    category_id: z.string(),
    categorias: z.array(z.string()),
    address: z.string(),
    external_id: z.string(),
    radius_m: finite,
    lat: finite.nullable(),
    lon: finite.nullable(),
    geom: geometry,
    polyBase,
    rectVinculado: z.boolean(),
    rect_w_m: finite,
    rect_h_m: finite,
    vertices: latLons,
    cerrado: z.boolean(),
    pasado: z.array(latLons),
    futuro: z.array(latLons),
    metadata: z.array(z.object({ k: z.string(), v: z.string() })),
    active_from: z.string(),
    active_until: z.string(),
    inners: z.array(innerSchema),
    innerEditId: z.string().nullable(),
    busqueda: z.string(),
    ubicadoEn: z.string().nullable(),
  })
  .partial()
  .passthrough();
const routeSchema = z
  .object({
    id: z.string().nullable(),
    name: z.string(),
    icon: z.string(),
    kind: z.enum(["vial", "interno"]),
    width_m: finite,
    external_id: z.string(),
    pts: latLons,
    ajustado: z.boolean(),
    vias: z.array(z.string()),
    recorrido: points,
    categorias: z.array(z.string()),
    confirmado: z.boolean(),
    pasado: z.array(points),
    futuro: z.array(points),
  })
  .partial()
  .passthrough();

const borradorSchema = z.object({
  guardadoEn: z.number(),
  borrador: z.discriminatedUnion("tipo", [
    z.object({
      tipo: z.literal("lugar"),
      form: placeSchema,
      paso: z.enum(["geocerca", "interiores"]),
      original: placeSchema.nullable(),
      inicial: placeSchema.nullable().optional(),
    }),
    z.object({
      tipo: z.literal("trayecto"),
      tray: routeSchema,
      paso: z.enum(["recorrido", "datos"]),
      original: routeSchema.nullable(),
      inicial: routeSchema.nullable().optional(),
      pathAjustado: latLons.nullable(),
    }),
  ]),
});

const clave = (ambito: AmbitoBorrador, scope: string | null) =>
  placesStorageKey(`${PREFIJO}${ambito}`, scope);

/** Lo guardado sobre los valores por defecto: tolera campos nuevos. */
const conLugar = (f: z.infer<typeof placeSchema>): FormLugar => ({
  ...FORM_VACIO,
  ...f,
});
const conTrayecto = (t: z.infer<typeof routeSchema>): FormTrayecto => ({
  ...TRAY_VACIO,
  ...t,
});

export function guardarBorrador(
  ambito: AmbitoBorrador,
  scope: string | null,
  borrador: Borrador
) {
  const key = clave(ambito, scope);
  if (!key) return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ guardadoEn: Date.now(), borrador })
    );
  } catch {
    // sin espacio o sin acceso: se sigue sin borrador
  }
}

export function borrarBorrador(ambito: AmbitoBorrador, scope: string | null) {
  const key = clave(ambito, scope);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // sin acceso: no hay nada que borrar
  }
}

export function leerBorrador(
  ambito: AmbitoBorrador,
  scope: string | null,
  ahora = Date.now()
): Borrador | null {
  const key = clave(ambito, scope);
  if (!key) return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: z.infer<typeof borradorSchema>;
  try {
    parsed = borradorSchema.parse(JSON.parse(raw));
  } catch {
    borrarBorrador(ambito, scope);
    return null;
  }
  if (ahora - parsed.guardadoEn > VIGENCIA_MS) {
    borrarBorrador(ambito, scope);
    return null;
  }
  const b = parsed.borrador;
  if (b.tipo === "lugar") {
    return {
      tipo: "lugar",
      form: conLugar(b.form),
      paso: b.paso,
      original: b.original ? conLugar(b.original) : null,
      inicial: b.inicial ? conLugar(b.inicial) : null,
    };
  }
  return {
    tipo: "trayecto",
    tray: conTrayecto(b.tray),
    paso: b.paso,
    original: b.original ? conTrayecto(b.original) : null,
    inicial: b.inicial ? conTrayecto(b.inicial) : null,
    pathAjustado: b.pathAjustado,
  };
}

export const hayBorrador = (ambito: AmbitoBorrador, scope: string | null) =>
  leerBorrador(ambito, scope) !== null;

/** Reconfirm road routes whose calculation was interrupted by a page reload. */
export function prepararTrayectoRestaurado(
  b: BorradorTrayecto
): BorradorTrayecto {
  if (b.tray.kind !== "vial" || !b.tray.confirmado || b.pathAjustado) return b;
  return {
    ...b,
    tray: { ...b.tray, confirmado: false, ajustado: false },
    paso: "recorrido",
  };
}

// Borrador del formulario abierto (lugar o trayecto) en localStorage: al
// recargar la página se puede seguir donde se quedó. Cada mapa (vista
// geográfica, mapa del viaje) guarda el suyo. Se borra al cerrar o guardar.
import { z } from "zod";
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

const objeto = z.record(z.string(), z.unknown());
const latLons = z.array(z.tuple([z.number(), z.number()]));

const borradorSchema = z.object({
  guardadoEn: z.number(),
  borrador: z.discriminatedUnion("tipo", [
    z.object({
      tipo: z.literal("lugar"),
      form: objeto,
      paso: z.enum(["geocerca", "interiores"]),
      original: objeto.nullable(),
      inicial: objeto.nullable().optional(),
    }),
    z.object({
      tipo: z.literal("trayecto"),
      tray: objeto,
      paso: z.enum(["recorrido", "datos"]),
      original: objeto.nullable(),
      inicial: objeto.nullable().optional(),
      pathAjustado: latLons.nullable(),
    }),
  ]),
});

const clave = (ambito: AmbitoBorrador) => `${PREFIJO}${ambito}`;

/** Lo guardado sobre los valores por defecto: tolera campos nuevos. */
const conLugar = (f: Record<string, unknown>) =>
  ({ ...FORM_VACIO, ...f }) as FormLugar;
const conTrayecto = (t: Record<string, unknown>) =>
  ({ ...TRAY_VACIO, ...t }) as FormTrayecto;

export function guardarBorrador(ambito: AmbitoBorrador, borrador: Borrador) {
  try {
    window.localStorage.setItem(
      clave(ambito),
      JSON.stringify({ guardadoEn: Date.now(), borrador })
    );
  } catch {
    // sin espacio o sin acceso: se sigue sin borrador
  }
}

export function borrarBorrador(ambito: AmbitoBorrador) {
  try {
    window.localStorage.removeItem(clave(ambito));
  } catch {
    // sin acceso: no hay nada que borrar
  }
}

export function leerBorrador(
  ambito: AmbitoBorrador,
  ahora = Date.now()
): Borrador | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(clave(ambito));
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: z.infer<typeof borradorSchema>;
  try {
    parsed = borradorSchema.parse(JSON.parse(raw));
  } catch {
    borrarBorrador(ambito);
    return null;
  }
  if (ahora - parsed.guardadoEn > VIGENCIA_MS) {
    borrarBorrador(ambito);
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

export const hayBorrador = (ambito: AmbitoBorrador) =>
  leerBorrador(ambito) !== null;

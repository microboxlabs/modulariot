// Lugares y trayectos guardados en el modulith (miot-places, tabla
// miot_places.place). Cada uno es un Feature GeoJSON: una geocerca o geocerca
// interior es un Polygon; un trayecto, un LineString. Un círculo se envía como
// Point con properties.radius_m y el servidor lo guarda como polígono con
// properties.shape = "circle", center y radius_m, de donde se rehace al leer.
// GeoJSON va [lon, lat]; la app, [lat, lon]: la conversión pasa solo aquí.
import { z } from "zod";
import {
  CATEGORIAS_KEY,
  CATEGORIAS_LISTA_KEY,
  COLOR_KEY,
  ICON_KEY,
  INNER_KEY,
  PARENT_KEY,
  categoriasDeLugar,
  colorDeLugar,
  iconoDeLugar,
  listaDeLugar,
  type LatLon,
  type Lugar,
  type TipoPunto,
  type Trayecto,
} from "../places.types";

/** De dónde lee y escribe Lugares lo guardado (proxy de `/places/items`). */
export const URL_LUGARES_GUARDADOS = "/app/api/places/items";

const punto = z.array(z.number()).min(2);

const geometria = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: punto }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(punto)),
  }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(punto) }),
]);

const texto = z.string().nullable().catch(null);

/** Los códigos elegidos y el seleccionable donde buscar sus nombres. */
const categoriasSchema = z.object({
  selectable: z.string(),
  values: z.array(z.string()),
});

/** Lo que la app guarda en properties del trayecto (su recorrido). */
const propsTrayecto = z.object({
  kind: z.string().optional().catch(undefined),
  ajustado: z.boolean().optional().catch(undefined),
  waypoints: z.array(punto).optional().catch(undefined),
  tipos_puntos: z
    .array(z.enum(["parada", "desvio"]))
    .optional()
    .catch(undefined),
  categorias_puntos: z.array(z.string().nullable()).optional().catch(undefined),
  categorias_puntos_selectable: z.string().optional().catch(undefined),
  width_m: z.number().positive().optional().catch(undefined),
});

/** Un lugar como lo sirve miot-places (`PlaceView`). */
export const placeViewSchema = z.object({
  id: z.string(),
  kind: z.enum(["geofence", "inner_geofence", "route"]),
  parentId: texto,
  externalCode: texto,
  name: z.string(),
  icon: texto,
  color: texto,
  address: texto,
  categories: categoriasSchema.nullable().catch(null),
  // cualquier JSON: uno anidado no puede dejar sin los demás datos
  metadata: z.record(z.string(), z.unknown()).nullable().catch(null),
  geojson: z.object({
    type: z.literal("Feature"),
    geometry: geometria,
    properties: z.record(z.string(), z.unknown()).nullable().catch(null),
  }),
  validFrom: texto,
  validUntil: texto,
  /** Una geocerca interior no tiene: va en la versión de su geocerca. */
  currentVersion: texto,
});

export type PlaceView = z.infer<typeof placeViewSchema>;

/** El tamaño de una edición, su descripción y qué cambió: toda edición es una versión. */
const versionRequestSchema = z.object({
  bump: z.enum(["MAJOR", "MINOR", "PATCH"]),
  reason: z.string().nullable(),
  changes: z.array(z.string()),
});

export type VersionRequest = z.infer<typeof versionRequestSchema>;

const placeBaseSchema = z.object({
  kind: z.enum(["geofence", "inner_geofence", "route"]).optional(),
  parentId: z.string().nullable(),
  externalCode: z.string().nullable(),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  address: z.string().nullable(),
  categories: categoriasSchema.nullable(),
  // lo que el formulario no tocó vuelve con su tipo (número, booleano, objeto)
  metadata: z.record(z.string(), z.unknown()),
  geojson: z.object({
    type: z.literal("Feature"),
    geometry: geometria,
    properties: z.record(z.string(), z.unknown()),
  }),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
});

/**
 * Lo que se envía al guardar (`PlaceRequest` de miot-places). Una geocerca va
 * con todas sus geocercas interiores en `inners` (con `id` las que ya están
 * guardadas; las que faltan se eliminan) y una edición, con su `version`.
 */
export const placeRequestSchema = placeBaseSchema.extend({
  inners: z
    .array(placeBaseSchema.extend({ id: z.string().nullable() }))
    .optional(),
  version: versionRequestSchema.optional(),
});

export type PlaceRequest = z.infer<typeof placeRequestSchema>;

/** Metadata tal como está guardada, con sus tipos, por id del lugar o trayecto. */
export type MetadatosGuardados = Record<string, Record<string, unknown>>;

/**
 * Lo guardado, ya con la forma que usa Lugares. `metadatos`: la metadata de
 * cada uno con sus tipos, que el formulario lee como texto (ver
 * {@link conMetadataGuardada}).
 */
export type Guardados = {
  lugares: Lugar[];
  trayectos: Trayecto[];
  metadatos?: MetadatosGuardados;
};

const CLAVES_PROPIAS = new Set([
  ICON_KEY,
  INNER_KEY,
  PARENT_KEY,
  COLOR_KEY,
  CATEGORIAS_KEY,
  CATEGORIAS_LISTA_KEY,
]);

/** Sin códigos o sin su lista no hay categorías: null, nada que buscar. */
const categoriasParaGuardar = (
  values: string[] | null | undefined,
  selectable: string | null | undefined
) => {
  if (!values?.length) return null;
  if (!selectable?.trim()) throw new RangeError("A category list is required");
  return { selectable, values };
};

const aGeo = ([lat, lon]: LatLon): [number, number] => [lon, lat];
const aApp = (p: number[]): LatLon => [p[1] ?? Number.NaN, p[0] ?? Number.NaN];

/** Anillo cerrado [lon, lat] desde vértices [lat, lon]. */
function anilloCerrado(vertices: LatLon[]): [number, number][] {
  const ring = vertices.map(aGeo);
  const [primero] = ring;
  const ultimo = ring.at(-1);
  const cerrado = primero?.[0] === ultimo?.[0] && primero?.[1] === ultimo?.[1];
  if (primero && !cerrado) ring.push([...primero]);
  return ring;
}

/** Vértices [lat, lon] de un anillo, sin repetir el punto de cierre. */
function verticesDeAnillo(ring: number[][]): LatLon[] {
  const vs = ring.map(aApp);
  const [primero] = vs;
  const ultimo = vs.at(-1);
  const cerrado =
    vs.length > 1 &&
    primero?.[0] === ultimo?.[0] &&
    primero?.[1] === ultimo?.[1];
  return cerrado ? vs.slice(0, -1) : vs;
}

const promedio = (vs: LatLon[]): LatLon | null =>
  vs.length === 0
    ? null
    : [
        vs.reduce((s, v) => s + v[0], 0) / vs.length,
        vs.reduce((s, v) => s + v[1], 0) / vs.length,
      ];

/** Fecha del formulario (AAAA-MM-DD) como instante: inicio o fin del día. */
function instante(fecha: string | null, finDelDia: boolean): string | null {
  if (!fecha) return null;
  const dia = fecha.slice(0, 10);
  return finDelDia ? `${dia}T23:59:59Z` : `${dia}T00:00:00Z`;
}

/** metadata libre del lugar, sin las claves que ya tienen su campo. */
function metadataLibre(
  metadata: Record<string, string> | null
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata ?? {})) {
    if (!CLAVES_PROPIAS.has(k)) out[k] = v;
  }
  return out;
}

function geometriaDeLugar(l: Lugar): PlaceRequest["geojson"] {
  const poligono = l.geometry_type
    ? l.geometry_type === "polygon"
    : !!l.polygon;
  if (poligono) {
    const properties: Record<string, unknown> = {};
    if (l.center) properties.center = aGeo(l.center);
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          anilloCerrado(l.polygon ?? []),
          ...(l.polygon_holes ?? []).map(anilloCerrado),
        ],
      },
      properties,
    };
  }
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: aGeo(l.center ?? [0, 0]) },
    properties: { radius_m: l.radius_m ?? 0 },
  };
}

/** Un lugar (o geocerca interior, con `parentId`) como cuerpo para guardar. */
export function requestDesdeLugar(
  l: Lugar,
  parentId: string | null
): PlaceRequest {
  return {
    kind: parentId ? "inner_geofence" : "geofence",
    parentId,
    externalCode: l.external_id || null,
    name: l.name.trim(),
    icon: iconoDeLugar(l) || null,
    color: colorDeLugar(l, "") || null,
    address: l.address || null,
    categories: categoriasParaGuardar(categoriasDeLugar(l), listaDeLugar(l)),
    metadata: metadataLibre(l.metadata),
    geojson: geometriaDeLugar(l),
    validFrom: instante(l.active_from, false),
    validUntil: instante(l.active_until, true),
  };
}

/** Una geocerca interior guardada (`id`) o nueva (null) dentro de su geocerca. */
export type InteriorGuardable = { lugar: Lugar; id: string | null };

/**
 * Una geocerca con todas sus geocercas interiores, como cuerpo para guardar:
 * las interiores que no vengan se eliminan.
 */
export function requestDesdeGeocerca(
  padre: Lugar,
  interiores: InteriorGuardable[]
): PlaceRequest {
  return {
    ...requestDesdeLugar(padre, null),
    inners: interiores.map(({ lugar, id }) => ({
      ...requestDesdeLugar(lugar, null),
      kind: "inner_geofence",
      id,
    })),
  };
}

/** Un trayecto como cuerpo para guardar: su camino y, en properties, su recorrido. */
export function requestDesdeTrayecto(t: Trayecto): PlaceRequest {
  const properties: Record<string, unknown> = {
    kind: t.kind,
    ajustado: !!t.ajustado,
  };
  if (t.width_m) properties.width_m = t.width_m;
  if (t.waypoints?.length) properties.waypoints = t.waypoints.map(aGeo);
  if (t.tipos_puntos?.length) properties.tipos_puntos = t.tipos_puntos;
  if (t.categorias_puntos?.length) {
    properties.categorias_puntos = t.categorias_puntos;
    if (t.categorias_puntos_lista)
      properties.categorias_puntos_selectable = t.categorias_puntos_lista;
  }
  return {
    kind: "route",
    parentId: null,
    externalCode: t.external_id || null,
    name: t.name.trim(),
    icon: t.icon || null,
    color: null,
    address: null,
    categories: categoriasParaGuardar(t.categorias, t.categorias_lista),
    metadata: {},
    geojson: {
      type: "Feature",
      geometry: { type: "LineString", coordinates: t.points.map(aGeo) },
      properties,
    },
    validFrom: null,
    validUntil: null,
  };
}

/** Un valor de metadata como texto del formulario; uno anidado, como su JSON. */
const textoDeDato = (val: unknown): string =>
  typeof val === "object" && val !== null ? JSON.stringify(val) : String(val);

/**
 * La metadata a enviar con sus tipos: un valor que el formulario no cambió
 * (su texto es el del guardado) vuelve como estaba guardado, número, booleano
 * u objeto. Uno cambiado va como texto: el formulario no sabe qué tipo quiso
 * quien lo escribió.
 */
export function metadataConTipos(
  enviada: Record<string, unknown>,
  guardada: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...enviada };
  for (const [k, v] of Object.entries(enviada)) {
    const antes = guardada?.[k];
    if (
      antes !== undefined &&
      typeof v === "string" &&
      textoDeDato(antes) === v
    )
      out[k] = antes;
  }
  return out;
}

/**
 * El cuerpo a guardar sin perder los tipos de la metadata guardada: la de la
 * geocerca y la de cada interior ya guardada, por su id. Un trayecto no edita
 * su metadata: va la guardada tal cual.
 */
export function conMetadataGuardada(
  id: string | null,
  body: PlaceRequest,
  metadatos: MetadatosGuardados | undefined
): PlaceRequest {
  const guardada = id ? metadatos?.[id] : undefined;
  const metadata =
    body.kind === "route"
      ? (guardada ?? body.metadata)
      : metadataConTipos(body.metadata, guardada);
  return {
    ...body,
    metadata,
    inners: body.inners?.map((inner) => ({
      ...inner,
      metadata: metadataConTipos(
        {
          ...(inner.id ? metadatos?.[inner.id] : undefined),
          ...inner.metadata,
        },
        inner.id ? metadatos?.[inner.id] : undefined
      ),
    })),
  };
}

/** metadata de la app: la libre más icono, color, categorías y padre. */
function metadataDeLugar(v: PlaceView): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v.metadata ?? {})) {
    out[k] = textoDeDato(val);
  }
  if (v.icon) out[ICON_KEY] = v.icon;
  if (v.color) out[COLOR_KEY] = v.color;
  if (v.categories) {
    out[CATEGORIAS_KEY] = JSON.stringify(v.categories.values);
    out[CATEGORIAS_LISTA_KEY] = v.categories.selectable;
  }
  if (v.parentId) out[PARENT_KEY] = v.parentId;
  return out;
}

function centroGuardado(v: PlaceView): LatLon | null {
  const c = v.geojson.properties?.center;
  const parsed = punto.safeParse(c);
  return parsed.success ? aApp(parsed.data) : null;
}

function radioGuardado(v: PlaceView): number | null {
  const r = v.geojson.properties?.radius_m;
  return typeof r === "number" ? r : null;
}

/** Una geocerca o geocerca interior guardada como lugar; un trayecto da null. */
export function lugarDesdePlace(v: PlaceView): Lugar | null {
  const g = v.geojson.geometry;
  if (g.type === "LineString") return null;
  const base = {
    place_id: v.id,
    name: v.name,
    address: v.address,
    category: null,
    category_id: null,
    color: v.color,
    metadata: metadataDeLugar(v),
    external_id: v.externalCode,
    active_from: v.validFrom,
    active_until: v.validUntil,
    icon: v.icon,
    version: v.currentVersion,
  };
  if (g.type === "Point") {
    return {
      ...base,
      geometry_type: "circle",
      center: aApp(g.coordinates),
      polygon: null,
      radius_m: radioGuardado(v),
    };
  }
  const radio = radioGuardado(v);
  const centro = centroGuardado(v);
  if (v.geojson.properties?.shape === "circle" && radio && centro) {
    return {
      ...base,
      geometry_type: "circle",
      center: centro,
      polygon: null,
      radius_m: radio,
    };
  }
  const vertices = verticesDeAnillo(g.coordinates[0] ?? []);
  return {
    ...base,
    geometry_type: "polygon",
    center: centroGuardado(v) ?? promedio(vertices),
    polygon: vertices,
    ...(g.coordinates.length > 1
      ? { polygon_holes: g.coordinates.slice(1).map(verticesDeAnillo) }
      : {}),
    radius_m: null,
  };
}

/** Un trayecto guardado; una geocerca da null. */
export function trayectoDesdePlace(v: PlaceView): Trayecto | null {
  const g = v.geojson.geometry;
  if (g.type !== "LineString") return null;
  const props = propsTrayecto.parse(v.geojson.properties ?? {});
  const tipos: TipoPunto[] | null = props.tipos_puntos ?? null;
  return {
    trayecto_id: v.id,
    name: v.name,
    kind: props.kind ?? "vial",
    width_m: props.width_m ?? null,
    points: g.coordinates.map(aApp),
    waypoints: props.waypoints?.map(aApp) ?? null,
    parent_name: null,
    ajustado: props.ajustado ?? null,
    external_id: v.externalCode,
    icon: v.icon,
    categorias: v.categories?.values ?? null,
    categorias_lista: v.categories?.selectable ?? null,
    tipos_puntos: tipos,
    categorias_puntos: props.categorias_puntos ?? null,
    categorias_puntos_lista: props.categorias_puntos_selectable ?? null,
    version: v.currentVersion,
  };
}

/** Lo guardado separado en lugares y trayectos. */
export function guardadosDesdePlaces(vs: PlaceView[]): Guardados {
  const lugares: Lugar[] = [];
  const trayectos: Trayecto[] = [];
  const metadatos: MetadatosGuardados = {};
  for (const v of vs) {
    if (v.metadata && Object.keys(v.metadata).length > 0)
      metadatos[v.id] = v.metadata;
    const lugar = lugarDesdePlace(v);
    if (lugar) lugares.push(lugar);
    const trayecto = trayectoDesdePlace(v);
    if (trayecto) trayectos.push(trayecto);
  }
  return { lugares, trayectos, metadatos };
}

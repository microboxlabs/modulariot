"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import type { MapRef, MapMouseEvent } from "react-map-gl";
import type { Feature, FeatureCollection, Polygon, LineString } from "geojson";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { useSession } from "next-auth/react";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { anclaLugar, itemsDesdeFC, type ItemNombre } from "../map/place-labels";
import type { BadgeMapa } from "../map/place-name-layer";
import { radioLugarM } from "../map/geofence-lod";
import type { MapStyleName } from "@/features/map-visualization/map-visualization";
import {
  agregarVertice,
  anilloGeoJSON,
  cancelarDibujo,
  geometriaDibujo,
  deshacer,
  rehacer,
  seguirDibujando,
  terminar,
} from "../geofences/polygon-draw";
import { direccionDesdePunto } from "../data/geocoding";
import {
  borrarRecorrido,
  confirmarRecorrido,
  deshacerRecorrido,
  editarRecorrido,
  primerPuntoVacio,
  puntoDesdeMapa,
  puntosRecorrido,
  puntosUbicados,
  recorridoDesdePts,
  rehacerRecorrido,
  rotularPunto,
  textoDesdeCoords,
  cambiarTipoPunto,
  longitudM,
  tiposUbicados,
  waypointsDirections,
} from "../routes/recorrido";
import { ajustarRutaAMaximo } from "../routes/simplify-route";
import {
  COLOR_KEY,
  FORM_VACIO,
  PARENT_KEY,
  TRAY_VACIO,
  type FormLugar,
  type FormTrayecto,
  type InnerGeofence,
  type LatLon,
  type PasoLugar,
  type PasoTrayecto,
  type TipoPunto,
  type Lugar,
  type Trayecto,
  categoriasDeLugar,
  listaDeLugar,
  colorDeFormLugar,
  colorDeLugar,
  iconoDeLugar,
  metadataAFilas,
} from "../places.types";
import {
  actualizarInner,
  colorInner,
  idsHijosDe,
  innerComoForm,
  innerEnEdicion,
  innersDelLugar,
  innersParaGuardar,
  lugarHijoDesdeInner,
  mensajePadreIncompleto,
  parentPlaceId,
  puntoDentroDelPadre,
} from "../geofences/inner-geofences";
import {
  fusionarPorId,
  isLocalId,
  lugarDesdeForm,
  trayectoDesdeForm,
  useLocalPlaces,
} from "../data/local-store";
import {
  esPoligonoLibre,
  mapaAgregaPunto,
  aplicarFormaBase,
} from "../geofences/geofence-editor";
import { filtrarLugares } from "../catalog/catalog-search";
import {
  cajaDePuntos,
  encuadrarCaja,
  ubicarPuntoEnMapa,
} from "../map/places-map-camera";
import {
  filaEsLinea,
  filaEsPoligono,
  filasDeLotes,
  lugarDesdeFilaImport,
  parsearArchivoLugares,
  type FilaImport,
  type LoteImport,
} from "../import-export/import-places";
import {
  contorno,
  detectarConflictos,
  formaDeFila,
  formaDeLugar,
  formaDeTrayecto,
  idConflicto,
  gravedad,
  planImport,
  type ConflictoImport,
  type DecisionImport,
  type FilaConUid,
} from "../import-export/import-conflicts";
import {
  VERSION_INICIAL,
  cambiosLugar,
  cambiosTrayecto,
  type CambioVersion,
  type TipoVersionado,
  type VersionBump,
} from "../versioning/versioning";
import type { VersionPendiente } from "../versioning/version-dialog";
import { resumenSeleccion } from "../catalog/list-selection";
import { enSerie } from "../data/en-serie";
import { ejecutarImport } from "../import-export/execute-import";
import {
  borrarBorrador,
  guardarBorrador,
  leerBorrador,
  prepararTrayectoRestaurado,
  type AmbitoBorrador,
  type Borrador,
} from "../data/draft-store";
import { cambioLugar, cambioTrayecto } from "../data/form-changes";
import { esDeStreamhub } from "../data/streamhub-geofences";
import {
  URL_LUGARES_GUARDADOS,
  conMetadataGuardada,
  requestDesdeGeocerca,
  requestDesdeLugar,
  requestDesdeTrayecto,
  type Guardados,
  type MetadatosGuardados,
  type InteriorGuardable,
  type PlaceRequest,
  type VersionRequest,
} from "../data/saved-places";
import {
  borrarPlace,
  guardarPlace,
  type Escritura,
} from "../data/saved-places-api";
import { errorLugar, faltaExternalId } from "../geofences/place-validation";
import { bloqueaCodigo, useCodigoEnUso } from "./use-codigo-en-uso";
import { useCodigosInteriores } from "./use-codigos-interiores";
import { useNombresDeCategoria } from "./use-nombres-categorias";
import {
  errorTrayecto,
  faltaExternalIdTrayecto,
} from "../routes/trayecto-validation";
import { textosLugares, type TextosLugares } from "../i18n/places-i18n";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

/** Versión elegida en el diálogo, que viaja con la edición. */
type NuevaVersion = {
  tipo: TipoVersionado;
  id: string;
  actual: string;
  bump: VersionBump;
  descripcion: string;
  cambios: CambioVersion[];
};

const aVersionRequest = (v: NuevaVersion): VersionRequest => ({
  bump: v.bump,
  reason: v.descripcion,
  changes: v.cambios.map((c) => c.texto),
});

/** Editado sin saber cómo estaba al abrirlo: el diálogo igual pide su versión. */
const edicionSinOriginal = (t: TextosLugares): CambioVersion => ({
  texto: t("workspace.data_edited"),
  bump: "PATCH",
});

/** Una edición sin diálogo (importación, quitar una interior de la lista). */
const versionAutomatica = (
  bump: VersionBump,
  reason: string,
  cambio: string
): VersionRequest => ({ bump, reason, changes: [cambio] });

/** Al reemplazar con un archivo: cambia la forma (MAYOR) o solo sus datos (PARCHE). */
function bumpDeReemplazo(antes: PlaceRequest, despues: PlaceRequest) {
  const forma = (r: PlaceRequest) => JSON.stringify(r.geojson.geometry);
  return forma(antes) === forma(despues) ? "PATCH" : "MAJOR";
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
const scopedFetcher = ([url]: readonly [string, string]) => fetcher(url);
function placesReadKey(
  enabled: boolean,
  scope: string | null,
  endpoint: string
): [string, string] | null {
  if (!enabled || !scope) return null;
  return [endpoint, scope];
}
// Resultado de un borrado en el servidor; null = el servidor no respondió.
function mensajeBorrado(
  t: TextosLugares,
  res: { ok?: boolean; detalle?: string; error?: string } | null,
  que: "lugar" | "trayecto",
  habiaCopiaLocal: boolean
): string {
  if (res === null && !habiaCopiaLocal) return t("workspace.delete_no_server");
  if (res === null)
    return t(
      que === "lugar"
        ? "workspace.place_removed_locally"
        : "workspace.route_removed_locally"
    );
  if (res.ok === false)
    return t("workspace.not_deleted", {
      error: res.detalle ?? res.error ?? "",
    });
  return t(
    que === "lugar" ? "workspace.place_deleted" : "workspace.route_deleted"
  );
}

/** Resultado de borrar como toast: éxito, aviso (solo local) o error. */
const borradoOk = (res: { ok?: boolean } | null): boolean =>
  res !== null && res.ok !== false;

/** Escritura en miot-places hecha (null = el servidor no respondió). */
const escrituraOk = (res: Escritura | null): boolean => res?.ok === true;

function avisarBorradoLote(t: TextosLugares, total: number, fallidos: number) {
  if (fallidos === 0) {
    toast.success(
      total === 1
        ? t("workspace.deleted_one")
        : t("workspace.deleted_many", { n: total })
    );
    return;
  }
  const ok = total - fallidos;
  toast.error(t("workspace.deleted_partial", { ok, total, fallidos }));
}

function avisarBorrado(
  t: TextosLugares,
  res: { ok?: boolean; detalle?: string; error?: string } | null,
  que: "lugar" | "trayecto",
  habiaCopiaLocal: boolean
) {
  const texto = mensajeBorrado(t, res, que, habiaCopiaLocal);
  if (res !== null && res.ok !== false) toast.success(texto);
  else if (res === null && habiaCopiaLocal) toast.warning(texto);
  else toast.error(texto);
}

/** Colores de borde bien distintos entre sí (gestor de conflictos). */
const PALETA_IMPORT = [
  "#2563EB",
  "#16A34A",
  "#9333EA",
  "#DB2777",
  "#0891B2",
  "#EA580C",
  "#4F46E5",
  "#65A30D",
  "#C026D3",
  "#0D9488",
];

function circuloPoly(
  lat: number,
  lon: number,
  radioM: number
): [number, number][] {
  const pts: [number, number][] = [];
  const dLat = radioM / 111_320;
  const dLon = radioM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 48; i++) {
    const a = (2 * Math.PI * i) / 48;
    pts.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return pts;
}

// Tope al encuadrar un trayecto: barrio visible.
const MAX_ZOOM_CREAR = 15;
// Al elegir la dirección de un punto del recorrido: nivel de calle.
const ZOOM_DIRECCION = 16;
// Tope al crear un círculo: el radio de 20 m cabe entero (nivel edificio).
const MAX_ZOOM_CIRCULO = 22;
// Al ir a una geocerca: qué parte del mapa ocupa (a lo ancho y a lo alto) y
// hasta dónde acerca una muy chica.
const PARTE_DE_LA_VISTA = 0.6;
const MAX_ZOOM_IR = 19;

// El tipo guardado manda: un círculo puede venir del servidor con su
// polígono proyectado y no debe abrirse como polígono de 48 vértices.
const esPoligono = (l: Lugar) =>
  l.geometry_type ? l.geometry_type === "polygon" : !!l.polygon;

// Caja [[oeste, sur], [este, norte]] que contiene el círculo del lugar.
function cajaCirculo(
  lat: number,
  lon: number,
  radioM: number
): [[number, number], [number, number]] {
  const dLat = radioM / 111_320;
  const dLon = radioM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat + dLat],
  ];
}

function fcLugares(
  lugares: Lugar[],
  propios: boolean,
  t: TextosLugares
): FeatureCollection {
  const features: Feature[] = [];
  for (const l of lugares) {
    if (!l.center && !l.polygon) continue;
    const ring: [number, number][] = l.polygon
      ? anilloGeoJSON(l.polygon)
      : circuloPoly(l.center![0], l.center![1], l.radius_m ?? 250);
    features.push({
      type: "Feature",
      properties: {
        name: l.name.trim() || t("map.unnamed_place"),
        color: colorDeLugar(l, propios ? "#1C64F2" : "#6B7280"),
        place_id: l.place_id,
        inner: Boolean(parentPlaceId(l)),
        parent_id: parentPlaceId(l),
        radius_m: radioLugarM(l),
        icon: iconoDeLugar(l) ?? "",
      },
      geometry: {
        type: "Polygon",
        coordinates: [ring, ...(l.polygon_holes ?? []).map(anilloGeoJSON)],
      } as Polygon,
    });
  }
  return { type: "FeatureCollection", features };
}
const fcLineas = (
  xs: { pts: [number, number][]; id?: string; name?: string; color?: string }[]
): FeatureCollection => ({
  type: "FeatureCollection",
  features: xs
    .filter((x) => x.pts?.length > 1)
    .map((x) => ({
      type: "Feature",
      properties: {
        trayecto_id: x.id ?? "",
        // badges (importando): id y nombre del trayecto
        place_id: x.id ?? "",
        name: x.name ?? "",
        icon: "ruta",
        ...(x.color ? { color: x.color } : {}),
      },
      geometry: {
        type: "LineString",
        coordinates: x.pts.map(([la, lo]) => [lo, la]),
      } as LineString,
    })),
});

// [lat,lon][] → Mapbox Directions (driving) → [lat,lon][] pegado a calles
// En orden: pasa por todos los puntos tal como están en la lista. Los
// desvíos van como puntos de paso (sin parar): ver waypointsDirections.
type DirectionsRoute = {
  geometry?: { coordinates?: number[][] };
  legs?: { steps?: { name?: string }[] }[];
};

/** Bajo el máximo de 500 del lab, con margen. */
const MAX_PUNTOS_RUTA = 480;

async function ajustarACalles(
  pts: [number, number][],
  token: string,
  tipos: TipoPunto[] = []
): Promise<{ pts: [number, number][]; vias: string[] } | null> {
  if (pts.length < 2 || pts.length > 25) return null;
  const coords = pts.map(([la, lo]) => `${lo},${la}`).join(";");
  const paradas =
    tipos.length === pts.length ? waypointsDirections(tipos) : null;
  const deParada = paradas ? `&waypoints=${paradas}` : "";
  // sin ruta (p. ej. entre continentes: Directions responde error) o sin
  // red: null, y el trayecto queda en línea recta
  let j: { routes?: DirectionsRoute[] } | null = null;
  try {
    const r = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&steps=true${deParada}&access_token=${token}`
    );
    if (!r.ok) return null;
    j = await r.json();
  } catch {
    return null;
  }
  const ruta = j?.routes?.[0];
  if (!ruta?.geometry?.coordinates) return null;
  const vias = new Set<string>();
  for (const leg of ruta.legs ?? [])
    for (const st of leg.steps ?? []) if (st.name) vias.add(st.name);
  // el lab acepta 2..500 puntos: se acorta sin cortar las curvas
  const crudos: [number, number][] = ruta.geometry.coordinates.map(
    ([lo, la]: number[]) => [la, lo] as [number, number]
  );
  return {
    pts: ajustarRutaAMaximo(crudos, MAX_PUNTOS_RUTA),
    vias: [...vias].slice(0, 12),
  };
}

// Mapbox simplifica GeoJSON al alejar el zoom (tolerance 0.375 por defecto):
// círculos chicos y polígonos detallados pierden vértices y dejan de coincidir
// con la geocerca real. 0 = dibujar siempre los vértices exactos.
export const GEOJSON_EXACTO = 0;

const IMP_VACIO = {
  lotes: [] as LoteImport[],
  resultado: null as string | null,
  /** Gestor de conflictos: decisión por fila (uid) y filas marcadas. */
  decisiones: {} as Record<string, DecisionImport>,
  seleccion: [] as string[],
};

let secuenciaImport = 0;
/** Id estable por fila: sobrevive a quitar filas o a otro archivo. */
const conUid = (filas: FilaImport[], archivo: string): FilaImport[] =>
  filas.map((f) => ({ ...f, uid: `${archivo}#${++secuenciaImport}` }));

/** Forma que se está dibujando: la geocerca o una de sus interiores. */
type FormaPrevia = Pick<
  InnerGeofence,
  "geom" | "lat" | "lon" | "radius_m" | "vertices" | "cerrado" | "polygon_holes"
>;

/**
 * Vista previa de una forma en el mapa: el círculo ubicado, o el polígono a
 * medio dibujar (línea) o cerrado (relleno). null si todavía no hay forma.
 */
function featurePrevia(
  forma: FormaPrevia,
  props: {
    inner: boolean;
    color: string;
    name: string;
    place_id: string;
    parent_id: string | null;
    icon: string;
  }
): Feature | null {
  if (forma.geom === "circle") {
    if (forma.lat == null || forma.lon == null) return null;
    return {
      type: "Feature",
      properties: { ...props, fill: true, radius_m: forma.radius_m },
      geometry: {
        type: "Polygon",
        coordinates: [circuloPoly(forma.lat, forma.lon, forma.radius_m)],
      } as Polygon,
    };
  }
  const geom = geometriaDibujo(forma.vertices, forma.cerrado);
  if (!geom) return null;
  if (geom.type === "Polygon")
    geom.coordinates.push(...(forma.polygon_holes ?? []).map(anilloGeoJSON));
  const center: LatLon | null =
    forma.lat != null && forma.lon != null ? [forma.lat, forma.lon] : null;
  return {
    type: "Feature",
    properties: {
      ...props,
      fill: forma.cerrado,
      radius_m: radioLugarM({
        polygon: forma.vertices,
        center,
        radius_m: forma.radius_m,
      }),
    },
    geometry: geom,
  };
}

/**
 * Un clic en el mapa sobre la forma que se dibuja (geocerca o interior):
 * ubica el círculo o la forma base la primera vez; en un polígono libre,
 * agrega un vértice.
 */
function conClicEnForma(f: FormLugar, p: LatLon): FormLugar {
  // las interiores llegan como FormLugar (actualizarInner): misma regla
  if (f.lat == null && f.geom === "circle")
    return { ...f, lat: p[0], lon: p[1] };
  if (f.geom === "circle") return f;
  if (esPoligonoLibre(f)) return agregarVertice(f, p);
  return f.lat == null ? aplicarFormaBase({ ...f, lat: p[0], lon: p[1] }) : f;
}

/** "Importadas 3 · actualizadas 1 · rechazadas 0" (solo lo que pasó). */
export function textoResultadoImport(
  r: {
    creadas: number;
    actualizadas: number;
    reemplazadas: number;
    locales: number;
    rechazadas: number;
  },
  t: TextosLugares = textosLugares()
): string {
  const partes = [t("import.result_created", { n: r.creadas })];
  if (r.actualizadas)
    partes.push(t("import.result_updated", { n: r.actualizadas }));
  if (r.reemplazadas)
    partes.push(t("import.result_replaced", { n: r.reemplazadas }));
  if (r.locales) partes.push(t("import.result_local", { n: r.locales }));
  partes.push(t("import.result_rejected", { n: r.rechazadas }));
  return partes.join(" · ");
}

/** En el formulario de lugar, si un clic en el mapa agrega un punto. */
function lugarAgregaPunto(
  paso: PasoLugar,
  form: FormLugar,
  innerActivo: InnerGeofence | null | undefined
): boolean {
  if (paso !== "interiores") return mapaAgregaPunto(form);
  return innerActivo ? mapaAgregaPunto(innerComoForm(innerActivo)) : false;
}

export function usePlacesWorkspace(
  mapRef: RefObject<MapRef | null>,
  options?: {
    enabled?: boolean;
    /**
     * Permiso "Editor de lugares": sin él, Lugares es de solo lectura (ver,
     * buscar, ir y descargar). Crear, editar, importar y borrar no corren.
     */
    puedeEditar?: boolean;
    /** Dónde se guarda el borrador del formulario abierto (uno por mapa). */
    ambito?: AmbitoBorrador;
    /** El diccionario de la página: los textos de Lugares en su idioma. */
    dict?: I18nRecord;
  }
) {
  const dict = options?.dict;
  const tx = useMemo(() => textosLugares(dict), [dict]);
  const enabled = options?.enabled ?? true;
  const puedeEditar = options?.puedeEditar ?? true;
  const ambito = options?.ambito ?? "geografico";
  const runtimeConfig = useRuntimeConfig();
  const MAPBOX_TOKEN = runtimeConfig?.MAPBOX_API_KEY;
  const { activeOrg } = useOrgScopes();
  const { data: session } = useSession();
  const storageScope =
    activeOrg?.slug && session?.user?.id
      ? JSON.stringify([session.user.id, activeOrg.slug])
      : null;
  const [mapStyle, setMapStyle] = useState<MapStyleName>("streets");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"ver" | "lugar" | "trayecto" | "import">(
    "ver"
  );
  const [form, setForm] = useState<FormLugar>({ ...FORM_VACIO });
  const [pasoLugar, setPasoLugar] = useState<PasoLugar>("geocerca");
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  // trayecto
  const [tray, setTray] = useState({ ...TRAY_VACIO });
  const [puntoMapaId, setPuntoMapaId] = useState<string | null>(null);
  // paso del formulario: primero el recorrido, después los datos
  const [pasoTrayecto, setPasoTrayecto] = useState<PasoTrayecto>("recorrido");
  // punto del recorrido bajo el mouse (lista o mapa): se resalta en ambos
  const [hoverPuntoId, setHoverPuntoId] = useState<string | null>(null);
  // menú "crear aquí" al hacer clic en el mapa en modo ver
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lon: number;
  } | null>(null);
  // menú del clic derecho sobre el badge de un lugar
  const [menuLugar, setMenuLugar] = useState<{
    x: number;
    y: number;
    lugar: Lugar;
  } | null>(null);
  // Menú contextual = efímero: si el mapa empieza a moverse (arrastre, zoom,
  // flyTo), se cierra; el mapa nunca queda bloqueado.
  const hayMenu = !!menu || !!menuLugar;
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!hayMenu || !map) return;
    const cerrar = () => {
      setMenu(null);
      setMenuLugar(null);
    };
    map.on("movestart", cerrar);
    return () => {
      map.off("movestart", cerrar);
    };
  }, [mapRef, hayMenu]);
  // badge bajo el mouse, según la capa de nombres (deck.gl)
  const badgeHover = useRef<ItemNombre | null>(null);
  // import
  const [imp, setImp] = useState({ ...IMP_VACIO });
  // fila del import bajo el mouse: se resalta y el mapa se acerca a ella
  const [hoverImportUid, setHoverImportUid] = useState<string | null>(null);
  // con qué choca la fila en hover (lugar guardado u otra fila): se marca
  const [hoverConflictoId, setHoverConflictoId] = useState<string | null>(null);
  const [trayPathAjustado, setTrayPathAjustado] = useState<
    [number, number][] | null
  >(null);
  const [msg, setMsg] = useState<string | null>(null);
  // confirmación de borrado con el modal del sistema (no window.confirm)
  // (el mismo modal de borrar un archivo en el visor multimedia del bento:
  // el nombre va en su recuadro gris)
  const [confirmacion, setConfirmacion] = useState<{
    titulo: string;
    nombre: string;
    accion: () => void;
  } | null>(null);
  const confirmar = (titulo: string, nombre: string, accion: () => void) =>
    setConfirmacion({ titulo, nombre, accion });
  const [guardando, setGuardando] = useState(false);
  // Invalidate late Directions results when the route or identity changes.
  const rutaSeq = useRef(0);
  // versionado: cómo estaba el elemento al abrirlo, para listar qué cambió
  const formOriginal = useRef<FormLugar | null>(null);
  const trayOriginal = useRef<FormTrayecto | null>(null);
  // cómo estaba el formulario al abrirse (nuevo o editado): ¿hay cambios?
  const inicialLugar = useRef<FormLugar | null>(null);
  const inicialTray = useRef<FormTrayecto | null>(null);
  // ✕ con cambios sin guardar: el aviso (guardar, salir o seguir)
  const [cierrePendiente, setCierrePendiente] = useState(false);
  const [versionPendiente, setVersionPendiente] = useState<
    (VersionPendiente & { tipo: TipoVersionado; id: string }) | null
  >(null);

  // solo lo de Lugares (miot-places: geocercas, interiores y trayectos); las
  // geocercas de StreamHub se están pasando a Lugares y ya no se muestran
  const { data: guardados, mutate: refG } = useSWR<Guardados>(
    placesReadKey(enabled, storageScope, URL_LUGARES_GUARDADOS),
    scopedFetcher
  );
  const local = useLocalPlaces(storageScope);
  /** Guarda sin perder los tipos de la metadata guardada (ver conMetadataGuardada). */
  const guardarConTipos = (
    id: string | null,
    body: PlaceRequest,
    metadatos = guardados?.metadatos
  ) => guardarPlace(id, conMetadataGuardada(id, body, metadatos));
  const lugaresGuardados = useMemo(() => guardados?.lugares ?? [], [guardados]);
  const trayectosGuardados = useMemo(
    () => guardados?.trayectos ?? [],
    [guardados]
  );
  const { lugares: propios, trayectos } = useNombresDeCategoria(
    lugaresGuardados,
    trayectosGuardados
  );
  /** Ids de lo guardado en miot-places: se editan y borran ahí. */
  const idsGuardados = useMemo(
    () =>
      new Set([
        ...(guardados?.lugares ?? []).map((l) => l.place_id),
        ...(guardados?.trayectos ?? []).map((t) => t.trayecto_id),
      ]),
    [guardados]
  );
  /** La versión vigente en el servidor de una geocerca o un trayecto. */
  const versionDe = useCallback(
    (tipo: TipoVersionado, id: string | null | undefined) => {
      if (!id) return null;
      if (tipo === "lugar")
        return (
          guardados?.lugares.find((l) => l.place_id === id)?.version ?? null
        );
      return (
        guardados?.trayectos.find((t) => t.trayecto_id === id)?.version ?? null
      );
    },
    [guardados]
  );
  /**
   * El External ID guardado en el servidor de una geocerca: una vez puesto no
   * cambia (es su llave con StreamHub).
   */
  const codigoDeLugar = useCallback(
    (id: string | null | undefined) =>
      guardados?.lugares.find((l) => l.place_id === id)?.external_id ?? null,
    [guardados]
  );
  // StreamHub is read-only; what is saved offline stays in this browser.
  const todosLugares = useMemo(
    () => fusionarPorId(propios, local.lugares, (l) => l.place_id),
    [propios, local.lugares]
  );
  // si el External ID escrito está libre: mientras se revisa o si está en uso,
  // el formulario no sigue adelante
  const estadoCodigoLugar = useCodigoEnUso({
    scope: storageScope,
    codigo: form.external_id,
    propioId: form.place_id,
    activo: modo === "lugar" && !codigoDeLugar(form.place_id),
    t: tx,
  });
  const estadoCodigoTrayecto = useCodigoEnUso({
    scope: storageScope,
    codigo: tray.external_id,
    propioId: tray.id,
    activo: modo === "trayecto",
    t: tx,
  });
  const codigoInteriorFijo = useCallback(
    (id: string) => !!codigoDeLugar(id),
    [codigoDeLugar]
  );
  const padreDeInteriores = useMemo(
    () => ({ codigo: form.external_id, nombre: form.name }),
    [form.external_id, form.name]
  );
  // las interiores guardadas que esta edición quita: se borran antes de guardar
  // las nuevas, así que sus códigos quedan libres para ellas
  const interioresQuitadas = useMemo(() => {
    const padre = form.place_id;
    if (!padre) return new Set<string>();
    const quedan = new Set(form.inners.map((i) => i.id));
    return new Set(
      (guardados?.lugares ?? [])
        .filter((l) => l.metadata?.[PARENT_KEY] === padre)
        .map((l) => l.place_id)
        .filter((id) => !quedan.has(id))
    );
  }, [guardados, form.place_id, form.inners]);
  const estadosCodigoInteriores = useCodigosInteriores({
    scope: storageScope,
    inners: form.inners,
    padre: padreDeInteriores,
    fija: codigoInteriorFijo,
    quitadas: interioresQuitadas,
    activo: modo === "lugar",
    t: tx,
  });
  /** Revisando o en uso: no se sigue; el campo ya dice por qué. */
  const interioresBloquean = () =>
    Object.values(estadosCodigoInteriores).some(bloqueaCodigo);
  const todosTrayectos = useMemo(
    () => fusionarPorId(trayectos, local.trayectos, (t) => t.trayecto_id),
    [trayectos, local.trayectos]
  );
  const refrescarTodo = () => {
    void refG();
  };

  const lugares = useMemo(
    () => filtrarLugares(todosLugares, busca),
    [todosLugares, busca]
  );

  // El lugar/trayecto en edición se dibuja solo como vista previa editable;
  // si también se dibujara el guardado, quedarían dos formas superpuestas.
  const editandoLugarId = modo === "lugar" ? form.place_id : null;
  const editandoTrayId = modo === "trayecto" ? tray.id : null;
  // ── Gestor de conflictos del import ──
  const filasImp = useMemo(
    () =>
      filasDeLotes(imp.lotes).filter((f): f is FilaConUid => Boolean(f.uid)),
    [imp.lotes]
  );
  const conflictosImp = useMemo(
    () => detectarConflictos(filasImp, todosLugares, todosTrayectos),
    [filasImp, todosLugares, todosTrayectos]
  );
  // con archivos cargados el mapa muestra solo lo importado y lo que choca
  const importando = modo === "import" && filasImp.length > 0;
  // importando: cada geocerca/trayecto en pantalla con su propio color de
  // borde (lo importado y lo guardado con que choca), para distinguirlos
  const coloresImport = useMemo(() => {
    const colores = new Map<string, string>();
    let i = 0;
    const siguiente = () => PALETA_IMPORT[i++ % PALETA_IMPORT.length]!;
    for (const f of filasImp) colores.set(f.uid, siguiente());
    for (const cs of conflictosImp.values())
      for (const c of cs) {
        const id = idConflicto(c);
        if (c.con.tipo !== "fila" && !colores.has(id))
          colores.set(id, siguiente());
      }
    return colores;
  }, [filasImp, conflictosImp]);
  // lugares y trayectos guardados con los que algo del import choca
  const idsConflictoImp = useMemo(() => {
    const ids = new Set<string>();
    for (const cs of conflictosImp.values())
      for (const c of cs) if (c.con.tipo !== "fila") ids.add(idConflicto(c));
    return ids;
  }, [conflictosImp]);
  const fcImport = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: filasImp.map((f) => {
        const cs = conflictosImp.get(f.uid);
        const coords = contorno(formaDeFila(f)).map(([la, lo]) => [lo, la]);
        // un trayecto es su camino; una geocerca, su contorno cerrado
        const geometry: Polygon | LineString = filaEsLinea(f)
          ? { type: "LineString", coordinates: coords }
          : { type: "Polygon", coordinates: [[...coords, coords[0] ?? []]] };
        return {
          type: "Feature",
          properties: {
            uid: f.uid,
            // los badges del mapa usan place_id como id del chip
            place_id: f.uid,
            name: f.name,
            estado: cs ? gravedad(cs) : "ok",
            color: coloresImport.get(f.uid) ?? "#1C64F2",
            // badge: un trayecto con el icono de ruta
            icon: filaEsLinea(f) ? "ruta" : "",
          },
          geometry,
        };
      }),
    }),
    [filasImp, conflictosImp, coloresImport]
  );

  const idsOcultosMapa = useMemo(() => {
    const ids = new Set<string>();
    if (editandoLugarId) {
      ids.add(editandoLugarId);
      for (const id of idsHijosDe(editandoLugarId, todosLugares)) ids.add(id);
    }
    for (const inner of form.inners) ids.add(inner.id);
    return ids;
  }, [editandoLugarId, todosLugares, form.inners]);
  const fcPropios = useMemo(() => {
    const fc = fcLugares(
      todosLugares.filter((l) =>
        importando
          ? idsConflictoImp.has(l.place_id)
          : !idsOcultosMapa.has(l.place_id)
      ),
      true,
      tx
    );
    if (!importando) return fc;
    // importando: el color de borde propio de cada uno (ver coloresImport)
    return {
      ...fc,
      features: fc.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          color:
            coloresImport.get(String(f.properties?.place_id)) ??
            f.properties?.color,
        },
      })),
    };
  }, [
    tx,
    todosLugares,
    idsOcultosMapa,
    importando,
    idsConflictoImp,
    coloresImport,
  ]);
  const fcTray = useMemo(
    () =>
      fcLineas(
        todosTrayectos
          .filter((t) =>
            importando
              ? idsConflictoImp.has(t.trayecto_id)
              : t.trayecto_id !== editandoTrayId
          )
          .map((t) => ({
            pts: t.points,
            id: t.trayecto_id,
            name: t.name,
            color: importando ? coloresImport.get(t.trayecto_id) : undefined,
          }))
      ),
    [todosTrayectos, editandoTrayId, importando, idsConflictoImp, coloresImport]
  );

  // importando: badges de lo importado (arriba de la forma) y de lo guardado
  // con que choca (debajo), con el color de borde de cada uno
  const nombresImport = useMemo(() => {
    if (!importando) return null;
    const guardados = [
      ...itemsDesdeFC(fcPropios, todosLugares, tx),
      ...itemsDesdeFC(fcTray, [], tx),
    ].map((i) => ({ ...i, abajo: true }));
    return [...itemsDesdeFC(fcImport, [], tx), ...guardados];
  }, [importando, fcImport, fcPropios, fcTray, todosLugares, tx]);

  const FC_VACIA: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  const linea = (pts: [number, number][]): FeatureCollection =>
    pts.length > 1
      ? {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: pts.map(([la, lo]) => [lo, la]),
              } as LineString,
            },
          ],
        }
      : FC_VACIA;
  const prevLugarFC = useMemo<FeatureCollection>(() => {
    if (modo !== "lugar") return FC_VACIA;
    const padreId = form.place_id || "preview-padre";
    const padre = featurePrevia(form, {
      inner: false,
      color: colorDeFormLugar(form),
      name: form.name.trim() || tx("workspace.new_place"),
      place_id: padreId,
      parent_id: null,
      icon: form.icon,
    });
    const interiores = form.inners.map((inner) =>
      featurePrevia(inner, {
        inner: true,
        color: colorInner(inner),
        name: inner.name.trim() || tx("map.unnamed_inner"),
        place_id: inner.id,
        parent_id: padreId,
        icon: "",
      })
    );
    const features = [padre, ...interiores].filter(
      (f): f is Feature => f != null
    );
    return features.length ? { type: "FeatureCollection", features } : FC_VACIA;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tx,
    modo,
    form.geom,
    form.lat,
    form.lon,
    form.radius_m,
    form.vertices,
    form.polygon_holes,
    form.cerrado,
    form.color,
    form.category_id,
    form.name,
    form.icon,
    form.place_id,
    form.inners,
  ]);
  const prevTrayRawFC = useMemo(
    () => {
      if (modo !== "trayecto") return FC_VACIA;
      // sin confirmar: línea entre los puntos ubicados, no la ruta
      if (!tray.confirmado) return linea(puntosUbicados(tray));
      return tray.ajustado && trayPathAjustado ? FC_VACIA : linea(tray.pts);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      modo,
      tray.confirmado,
      tray.recorrido,
      tray.pts,
      tray.ajustado,
      trayPathAjustado,
    ]
  );
  // largo del recorrido que se ve: el camino por calles, la línea confirmada
  // o, en borrador, la línea entre los puntos
  const distanciaTrayectoM = useMemo(() => {
    if (tray.ajustado && trayPathAjustado) return longitudM(trayPathAjustado);
    if (tray.pts.length > 1) return longitudM(tray.pts);
    return longitudM(puntosUbicados(tray));
  }, [tray, trayPathAjustado]);
  const prevTrayAdjFC = useMemo(
    () =>
      modo === "trayecto" && tray.ajustado && trayPathAjustado
        ? linea(trayPathAjustado)
        : FC_VACIA,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modo, tray.ajustado, trayPathAjustado]
  );

  const onHoverNombre = useCallback((item: ItemNombre | null) => {
    badgeHover.current = item;
  }, []);
  // badge (o cluster) bajo el mouse y su posición: tooltip con su información
  const [tooltipBadge, setTooltipBadge] = useState<{
    badge: BadgeMapa;
    x: number;
    y: number;
  } | null>(null);
  const onHoverBadge = useCallback(
    (badge: BadgeMapa | null, pos: { x: number; y: number }) =>
      setTooltipBadge(badge ? { badge, ...pos } : null),
    []
  );

  /** Lugar del badge si se puede editar (los de StreamHub no). */
  const lugarEditableDe = (item: ItemNombre | null): Lugar | null => {
    const l = item?.vistaPrevia ? undefined : item?.lugar;
    // las geocercas de StreamHub no tienen menú de configurar/eliminar
    if (!l || esDeStreamhub(l.place_id)) return null;
    return todosLugares.some((x) => x.place_id === l.place_id) ? l : null;
  };

  // Clic derecho en modo ver: sobre el badge de un lugar, su menú
  // (configurar / eliminar); en otro punto, crear un lugar o trayecto ahí.
  const onMapContextMenu = (e: MapMouseEvent) => {
    if (!puedeEditar) return;
    e.originalEvent.preventDefault(); // sin el menú del navegador
    if (modo !== "ver") return;
    const lugar = lugarEditableDe(badgeHover.current);
    if (lugar) {
      setMenu(null);
      setMenuLugar({ x: e.point.x, y: e.point.y, lugar });
      return;
    }
    setMenuLugar(null);
    setMenu({
      x: e.point.x,
      y: e.point.y,
      lat: e.lngLat.lat,
      lon: e.lngLat.lng,
    });
  };

  /** Clic sobre la interior que se dibuja: debe quedar dentro del lugar. */
  const clicEnInterior = (p: LatLon) => {
    const inner = innerEnEdicion(form);
    if (!inner) return;
    if (!puntoDentroDelPadre(form, p)) {
      setMsg(tx("workspace.inner_inside_place"));
      return;
    }
    setMsg(null);
    setForm((f) => actualizarInner(f, inner.id, (g) => conClicEnForma(g, p)));
  };

  /** Clic sobre la geocerca: el círculo nuevo además acerca el mapa a él. */
  const clicEnLugar = (p: LatLon) => {
    // círculo ya ubicado: se mueve arrastrando su centro, no con clic
    if (form.geom === "circle" && form.lat != null) return;
    setForm((f) => conClicEnForma(f, p));
    if (form.geom === "circle") encuadrarCirculo(p[0], p[1], form.radius_m);
  };

  const onMapClick = (e: MapMouseEvent) => {
    const p: LatLon = [e.lngLat.lat, e.lngLat.lng];
    if (modo === "ver") {
      // los menús se abren con clic derecho; un clic normal los cierra
      setMenu(null);
      setMenuLugar(null);
      return;
    }
    if (modo === "lugar") {
      if (pasoLugar === "interiores") clicEnInterior(p);
      else clicEnLugar(p);
      return;
    }
    // punto elegido en la lista o, mientras se dibuja, el siguiente vacío
    const idPunto =
      modo === "trayecto" && pasoTrayecto === "recorrido"
        ? (puntoMapaId ?? primerPuntoVacio(tray))
        : null;
    if (idPunto) ubicarPuntoEnRecorrido(idPunto, p);
  };

  // Acerca el mapa al círculo nuevo para dibujar con precisión: el radio
  // ocupa buena parte de la vista, dejando libre el lado de la ventana flotante.
  const encuadrarCirculo = (lat: number, lon: number, radioM: number) => {
    const map = mapRef.current;
    if (!map) return;
    const margen = 80;
    encuadrarCaja(map, cajaCirculo(lat, lon, radioM), {
      margen: {
        top: margen,
        bottom: margen,
        left: margen,
        right: margen,
      },
      maxZoom: MAX_ZOOM_CIRCULO,
      duration: 800,
    });
  };

  const rotularPuntoSiSigue = (id: string, punto: LatLon) => {
    if (!MAPBOX_TOKEN) return;
    void direccionDesdePunto(punto, MAPBOX_TOKEN).then((nom) => {
      if (!nom) return;
      setTray((t) => {
        const actual = t.recorrido.find((p) => p.id === id);
        // el punto se movió (o ya no está) mientras llegaba la dirección
        const sigueAhi =
          actual?.punto?.[0] === punto[0] && actual?.punto?.[1] === punto[1];
        if (!sigueAhi) return t;
        return rotularPunto(t, id, nom);
      });
    });
  };

  // un lugar nuevo: su geocerca circular parte en `punto`
  const empezarLugar = (punto: LatLon) => {
    encuadrarCirculo(punto[0], punto[1], FORM_VACIO.radius_m);
    const nuevo = { ...FORM_VACIO, lat: punto[0], lon: punto[1] };
    inicialLugar.current = nuevo;
    setForm(nuevo);
    setPasoLugar("geocerca");
    setMsg(null);
    setModo("lugar");
    setMenu(null);
    setMenuLugar(null);
  };
  // un trayecto nuevo: con origen ya puesto, o vacío (el clic pone el origen)
  const empezarTrayecto = (origen: LatLon | null) => {
    const nuevo = {
      ...TRAY_VACIO,
      recorrido: recorridoDesdePts(origen ? [origen] : []),
    };
    inicialTray.current = nuevo;
    setTray(nuevo);
    setTrayPathAjustado(null);
    setPuntoMapaId(origen ? "destino" : "origen");
    setPasoTrayecto("recorrido");
    setMsg(null);
    setModo("trayecto");
    setMenu(null);
    setMenuLugar(null);
    if (origen) rotularPuntoSiSigue("origen", origen);
  };
  const crearLugarAqui = () => {
    if (!puedeEditar) return;
    if (!menu) return;
    empezarLugar([menu.lat, menu.lon]);
  };
  const crearTrayectoAqui = () => {
    if (!puedeEditar) return;
    if (!menu) return;
    empezarTrayecto([menu.lat, menu.lon]);
  };
  // desde "Agregar" en la lista: sin un punto elegido, el centro del mapa
  const nuevoLugar = () => {
    if (!puedeEditar) return;
    const centro = centroMapa();
    if (centro) empezarLugar(centro);
  };
  const nuevoTrayecto = () => {
    if (!puedeEditar) return;
    empezarTrayecto(null);
  };
  const cerrarMenu = useCallback(() => setMenu(null), []);
  const cerrarMenuLugar = useCallback(() => setMenuLugar(null), []);
  const configurarDesdeMenu = () => {
    if (!puedeEditar) return;
    if (!menuLugar) return;
    setMenuLugar(null);
    editarLugar(menuLugar.lugar);
  };
  const eliminarDesdeMenu = () => {
    if (!puedeEditar) return;
    if (!menuLugar) return;
    setMenuLugar(null);
    borrarLugar(menuLugar.lugar);
  };
  // cuando un clic en el mapa agrega algo, el cursor es "+"
  const innerActivo =
    pasoLugar === "interiores" ? innerEnEdicion(form) : undefined;
  const clicAgrega =
    (modo === "trayecto" &&
      pasoTrayecto === "recorrido" &&
      (!!puntoMapaId || !!primerPuntoVacio(tray))) ||
    (modo === "lugar" && lugarAgregaPunto(pasoLugar, form, innerActivo));
  const terminarPoligono = useCallback(() => setForm(terminar), []);
  const deshacerPunto = useCallback(() => setForm(deshacer), []);
  const rehacerPunto = useCallback(() => setForm(rehacer), []);
  const seguirPoligono = useCallback(() => setForm(seguirDibujando), []);
  const cancelarPoligono = useCallback(() => setForm(cancelarDibujo), []);
  const cerrarForm = () => {
    rutaSeq.current++;
    setGuardando(false);
    formOriginal.current = null;
    trayOriginal.current = null;
    inicialLugar.current = null;
    inicialTray.current = null;
    setCierrePendiente(false);
    setVersionPendiente(null);
    setForm({ ...FORM_VACIO });
    setPasoLugar("geocerca");
    setTray({ ...TRAY_VACIO });
    setTrayPathAjustado(null);
    setPuntoMapaId(null);
    setPasoTrayecto("recorrido");
    setHoverPuntoId(null);
    setMsg(null);
    setModo("ver");
  };

  // ── Cerrar con cambios sin guardar: salir sin guardar o seguir editando ──
  const hayCambios = (): boolean => {
    if (modo === "lugar") {
      const inicial = inicialLugar.current;
      return !inicial || cambioLugar(inicial, form);
    }
    if (modo === "trayecto") {
      const inicial = inicialTray.current;
      return !inicial || cambioTrayecto(inicial, tray);
    }
    return false;
  };
  // lo que sigue a cerrar el formulario (p. ej. cerrar Lugares), si se sale
  const salidaPendiente = useRef<(() => void) | null>(null);
  /**
   * Salir del formulario (su ✕, o cerrar Lugares con `despues`): sin cambios
   * cierra y sigue; con cambios pregunta y sigue solo al salir sin guardar.
   */
  const pedirSalir = (despues?: () => void) => {
    if (hayCambios()) {
      salidaPendiente.current = despues ?? null;
      setCierrePendiente(true);
      return;
    }
    if (modo === "lugar" || modo === "trayecto") cerrarForm();
    despues?.();
  };
  const pedirCerrarForm = () => pedirSalir();
  const seguirEditando = () => {
    salidaPendiente.current = null;
    setCierrePendiente(false);
  };
  const salirSinGuardar = () => {
    const despues = salidaPendiente.current;
    salidaPendiente.current = null;
    cerrarForm();
    despues?.();
  };

  const continuarAInteriores = () => {
    if (mensajePadreIncompleto(form) || faltaExternalId(form)) return;
    if (bloqueaCodigo(estadoCodigoLugar)) return;
    setMsg(null);
    setPasoLugar("interiores");
  };

  const volverAGeocerca = () => {
    setMsg(null);
    setForm((f) => ({ ...f, innerEditId: null }));
    setPasoLugar("geocerca");
  };

  const workspaceScope = useRef(storageScope);
  useEffect(() => {
    if (enabled && workspaceScope.current === storageScope) return;
    workspaceScope.current = storageScope;
    rutaSeq.current++;
    setGuardando(false);
    salidaPendiente.current = null;
    badgeHover.current = null;
    setMenuLugar(null);
    setTooltipBadge(null);
    formOriginal.current = null;
    trayOriginal.current = null;
    inicialLugar.current = null;
    inicialTray.current = null;
    setCierrePendiente(false);
    setVersionPendiente(null);
    setForm({ ...FORM_VACIO });
    setPasoLugar("geocerca");
    setTray({ ...TRAY_VACIO });
    setTrayPathAjustado(null);
    setPuntoMapaId(null);
    setPasoTrayecto("recorrido");
    setHoverPuntoId(null);
    setImp({ ...IMP_VACIO });
    setMenu(null);
    setMsg(null);
    setConfirmacion(null);
    setHoveredPlaceId(null);
    setModo("ver");
  }, [enabled, storageScope]);
  // Abrir, cerrar o guardar un formulario desmonta la lista bajo el mouse (su
  // mouseleave no llega): la geocerca que estaba resaltada deja de estarlo.
  useEffect(() => setHoveredPlaceId(null), [modo]);
  // Borrador: lo abierto se guarda con cada cambio, así al recargar se sigue
  // ahí. Cerrar o guardar (volver a "ver" desde un formulario) lo borra.
  const modoAntes = useRef(modo);
  const draftScope = useRef(storageScope);
  useEffect(() => {
    if (draftScope.current !== storageScope) {
      draftScope.current = storageScope;
      modoAntes.current = "ver";
      return;
    }
    if (modo === "lugar") {
      guardarBorrador(ambito, storageScope, {
        tipo: "lugar",
        form,
        paso: pasoLugar,
        original: formOriginal.current,
        inicial: inicialLugar.current,
      });
    } else if (modo === "trayecto") {
      guardarBorrador(ambito, storageScope, {
        tipo: "trayecto",
        tray,
        paso: pasoTrayecto,
        original: trayOriginal.current,
        inicial: inicialTray.current,
        pathAjustado: trayPathAjustado,
      });
    } else if (
      modoAntes.current === "lugar" ||
      modoAntes.current === "trayecto"
    ) {
      borrarBorrador(ambito, storageScope);
    }
    modoAntes.current = modo;
  }, [
    ambito,
    storageScope,
    modo,
    form,
    pasoLugar,
    tray,
    pasoTrayecto,
    trayPathAjustado,
  ]);

  /** Tras recargar el mapa puede no estar montado aún: se espera (≤ 5 s). */
  const cuandoHayaMapa = (accion: () => void, intentos = 50) => {
    if (mapRef.current) accion();
    else if (intentos > 0)
      setTimeout(() => cuandoHayaMapa(accion, intentos - 1), 100);
  };

  /** Encuadra lo que trae el borrador: la geocerca o el recorrido. */
  const encuadrarBorrador = (b: Borrador) => {
    if (b.tipo === "lugar") {
      const f = b.form;
      if (f.geom === "polygon" && f.vertices.length > 0) {
        encuadrarPuntos(f.vertices);
      } else if (f.lat != null && f.lon != null) {
        encuadrarCirculo(f.lat, f.lon, f.radius_m);
      }
      return;
    }
    const camino = b.pathAjustado ?? b.tray.pts;
    const pts = camino.length
      ? camino
      : b.tray.recorrido.flatMap((p) => (p.punto ? [p.punto] : []));
    encuadrarRuta(pts);
  };

  /**
   * Retoma el borrador guardado (tras recargar). Devuelve si había uno; el
   * aviso permite descartarlo.
   */
  const restaurarBorrador = (): boolean => {
    if (!puedeEditar || modo !== "ver") return false;
    const b = leerBorrador(ambito, storageScope);
    if (!b) return false;
    setMsg(null);
    if (b.tipo === "lugar") {
      formOriginal.current = b.original;
      inicialLugar.current = b.inicial;
      setForm(b.form);
      setPasoLugar(b.paso);
      setModo("lugar");
    } else {
      trayOriginal.current = b.original;
      inicialTray.current = b.inicial;
      const recovered = prepararTrayectoRestaurado(b);
      setTray(recovered.tray);
      setTrayPathAjustado(recovered.pathAjustado);
      setPuntoMapaId(null);
      setPasoTrayecto(recovered.paso);
      setModo("trayecto");
    }
    // la forma a la vista (el mapa recién cargado está en su vista inicial)
    cuandoHayaMapa(() => encuadrarBorrador(b));
    const nombre = (b.tipo === "lugar" ? b.form.name : b.tray.name).trim();
    const sinNombre =
      b.tipo === "lugar"
        ? "workspace.recovered_place"
        : "workspace.recovered_route";
    toast.info(
      nombre ? tx("workspace.recovered_named", { nombre }) : tx(sinNombre),
      { action: { label: tx("workspace.discard"), onClick: cerrarForm } }
    );
    return true;
  };

  // Al abrir algo para editar: centrarlo sin tocar el zoom. La barra de
  // Lugares va al lado del mapa (no encima), así el centro del mapa es el
  // centro de lo que se ve.
  const centrarEnVista = (p: [number, number] | null) => {
    if (!p) return;
    mapRef.current?.easeTo({
      center: [p[1], p[0]],
      duration: 600,
    });
  };

  /** Punto elegido por dirección: vuela ahí a nivel de calle. */
  const acercarADireccion = (p: [number, number]) => {
    mapRef.current?.flyTo({
      center: [p[1], p[0]],
      zoom: ZOOM_DIRECCION,
      duration: 800,
    });
  };

  // Clic en el nombre de la lista: ir al lugar (con zoom de ciudad).
  /**
   * Ir a una geocerca: el zoom depende de su tamaño. Ella y sus interiores
   * quedan enteras en la vista, ocupando una parte (no todo el mapa).
   */
  const irALugar = (l: Lugar) => {
    const map = mapRef.current;
    const hijos = todosLugares.filter((x) => parentPlaceId(x) === l.place_id);
    const pts = [l, ...hijos].flatMap((x) => {
      const forma = formaDeLugar(x);
      return forma ? contorno(forma) : [];
    });
    if (map && pts.length > 0) {
      const el = map.getContainer();
      const libre = (1 - PARTE_DE_LA_VISTA) / 2;
      const x = el.clientWidth * libre;
      const y = el.clientHeight * libre;
      encuadrarCaja(map, cajaDePuntos(pts), {
        margen: { top: y, bottom: y, left: x, right: x },
        maxZoom: MAX_ZOOM_IR,
        duration: 600,
      });
      return;
    }
    const p = anclaLugar(l);
    if (p) map?.flyTo({ center: [p[1], p[0]], zoom: 13, duration: 400 });
  };

  // Clic en el nombre de un trayecto: ir a él en el mapa.
  // el trayecto completo en vista, de origen a destino
  const irATrayecto = (t: Trayecto) => encuadrarRuta(t.points);

  /** Ir a un punto cualquiera (p. ej. una geocerca del viaje). */
  const irAPunto = (p: LatLon) =>
    mapRef.current?.flyTo({ center: [p[1], p[0]], zoom: 14, duration: 600 });

  const editarLugar = (l: Lugar) => {
    if (!puedeEditar || esDeStreamhub(l.place_id)) return;
    const padreId = parentPlaceId(l);
    const padre = padreId
      ? todosLugares.find((x) => x.place_id === padreId)
      : undefined;
    const destino = padre ?? l;
    const innerId = padre ? l.place_id : null;
    setMenu(null);
    setModo("lugar");
    setPasoLugar(padre ? "interiores" : "geocerca");
    setMsg(null);
    const abierto: FormLugar = {
      ...FORM_VACIO,
      place_id: destino.place_id,
      name: destino.name,
      category_id:
        destino.category_id != null ? String(destino.category_id) : "",
      categorias: categoriasDeLugar(destino),
      categorias_lista: listaDeLugar(destino),
      address: destino.address ?? "",
      external_id: destino.external_id ?? "",
      radius_m: destino.radius_m ?? 250,
      lat: destino.center?.[0] ?? null,
      lon: destino.center?.[1] ?? null,
      geom: esPoligono(destino) ? "polygon" : "circle",
      cerrado: esPoligono(destino),
      vertices: esPoligono(destino) ? (destino.polygon ?? []) : [],
      polygon_holes: destino.polygon_holes ?? [],
      icon: iconoDeLugar(destino),
      color: destino.metadata?.[COLOR_KEY] ?? "",
      metadata: metadataAFilas(destino.metadata),
      active_from: destino.active_from?.slice(0, 10) ?? "",
      active_until: destino.active_until?.slice(0, 10) ?? "",
      inners: innersDelLugar(destino, todosLugares),
      innerEditId: innerId,
    };
    formOriginal.current = abierto;
    inicialLugar.current = abierto;
    setForm(abierto);
    centrarEnVista(anclaLugar(l));
  };

  /** El id en miot-places de lo que se edita; null si se guarda como nuevo. */
  const idGuardado = (id: string | null | undefined) =>
    id && idsGuardados.has(id) ? id : null;

  /**
   * El External ID con que miot-places tiene guardado un lugar o trayecto: se
   * borra por él. El del servidor, no el de una edición local sin guardar.
   */
  const codigoGuardado = (id: string): string | null =>
    guardados?.lugares.find((l) => l.place_id === id)?.external_id ??
    guardados?.trayectos.find((t) => t.trayecto_id === id)?.external_id ??
    null;

  const guardarLugar = async () => {
    // algo mal (forma, medidas, vigencia, interiores): no se guarda
    const error = errorLugar(form, tx);
    if (error) {
      setMsg(error);
      return;
    }
    if (bloqueaCodigo(estadoCodigoLugar) || interioresBloquean()) return;
    const orig = formOriginal.current;
    const id = idGuardado(form.place_id);
    // toda edición es una versión: sin cambios no hay nada que guardar
    if (id) {
      const cambios = orig
        ? cambiosLugar(orig, form, tx)
        : [edicionSinOriginal(tx)];
      pedirVersion("lugar", id, form.name, cambios);
      return;
    }
    await persistirLugar(null);
  };

  /** Editado: el diálogo de versión antes de guardar (sigue en confirmarVersion). */
  const pedirVersion = (
    tipo: TipoVersionado,
    id: string,
    nombre: string,
    cambios: CambioVersion[]
  ) => {
    if (cambios.length === 0) {
      toast.info(tx("workspace.no_changes"));
      return;
    }
    setVersionPendiente({
      tipo,
      id,
      nombre,
      que:
        tipo === "lugar"
          ? tx("versioning.the_geofence")
          : tx("versioning.the_route"),
      actual: versionDe(tipo, id) ?? VERSION_INICIAL,
      cambios,
    });
  };

  const confirmarVersion = (bump: VersionBump, descripcion: string) => {
    const p = versionPendiente;
    if (!p) return;
    setVersionPendiente(null);
    const v: NuevaVersion = {
      tipo: p.tipo,
      id: p.id,
      actual: p.actual,
      bump,
      descripcion,
      cambios: p.cambios,
    };
    if (p.tipo === "lugar") void persistirLugar(v);
    else void persistirTrayecto(v);
  };
  const cancelarVersion = () => setVersionPendiente(null);

  /** Las interiores del formulario, con su id si ya están guardadas. */
  const interioresDe = (padre: Lugar): InteriorGuardable[] =>
    innersParaGuardar(form.inners).map((inner) => ({
      lugar: lugarHijoDesdeInner(inner, padre),
      id: idGuardado(inner.id),
    }));

  /**
   * La geocerca con todas sus interiores, en una sola escritura: se guarda
   * entera o nada. Editada, va con su versión.
   */
  const persistirLugar = async (version: NuevaVersion | null) => {
    setGuardando(true);
    setMsg(null);
    // un lugar de prueba de este navegador se sube como nuevo
    const id = version ? idGuardado(form.place_id) : null;
    const padre = lugarDesdeForm(form, [], id ?? "");
    const res = await guardarConTipos(id, {
      ...requestDesdeGeocerca(padre, interioresDe(padre)),
      version: version ? aVersionRequest(version) : undefined,
    });
    setGuardando(false);
    if (res === null) {
      toast.error(tx("workspace.save_no_server"));
      return;
    }
    if (!res.ok) {
      toast.error(tx("workspace.not_saved", { error: res.error }));
      return;
    }
    // la copia de este navegador (de prueba o sin servidor) ya está arriba
    if (form.place_id) quitarCopiasLocales(form.place_id);
    setMsg(null);
    toast.success(
      id ? tx("workspace.place_updated") : tx("workspace.place_saved")
    );
    setForm({ ...FORM_VACIO });
    setPasoLugar("geocerca");
    setModo("ver");
    refrescarTodo();
  };

  /** Quita de este navegador la copia del lugar y de sus interiores. */
  const quitarCopiasLocales = (placeId: string) => {
    for (const id of [placeId, ...idsHijosDe(placeId, local.lugares)]) {
      local.deleteLugar(id);
    }
  };

  /**
   * Quita interiores guardadas editando su geocerca: es una versión MENOR de
   * ella, como quitarlas en el formulario.
   */
  const quitarInteriores = async (
    padreId: string,
    quitar: string[],
    lugares = todosLugares,
    metadatos: MetadatosGuardados | undefined = guardados?.metadatos
  ): Promise<Escritura | null> => {
    const padre = lugares.find((p) => p.place_id === padreId);
    if (!padre || !idGuardado(padreId)) {
      return { ok: false, error: tx("workspace.parent_not_saved") };
    }
    const fuera = new Set(quitar);
    const quedan = lugares.filter(
      (x) =>
        parentPlaceId(x) === padreId &&
        !fuera.has(x.place_id) &&
        !isLocalId(x.place_id)
    );
    const cambios = lugares
      .filter((x) => fuera.has(x.place_id))
      .map((x) => tx("workspace.inner_removed", { nombre: x.name }));
    return guardarConTipos(
      padreId,
      {
        ...requestDesdeGeocerca(
          padre,
          quedan.map((h) => ({ lugar: h, id: h.place_id }))
        ),
        version: {
          bump: "MINOR",
          reason: tx("workspace.deleted_from_list"),
          changes: cambios,
        },
      },
      metadatos
    );
  };

  const borrarLugar = (l: Lugar) => {
    if (!puedeEditar || esDeStreamhub(l.place_id)) return;
    confirmar(
      tx("workspace.delete_place"),
      l.name,
      () => void eliminarLugar(l)
    );
  };

  /** silencioso: en lote, sin aviso por elemento ni refresco (lo hace el lote). */
  const eliminarLugar = async (l: Lugar, silencioso = false) => {
    const hijos = idsHijosDe(l.place_id, todosLugares);
    // si estaba abierto en la ventana flotante, cerrarla
    if (
      modo === "lugar" &&
      (form.place_id === l.place_id || hijos.includes(form.place_id ?? ""))
    ) {
      cerrarForm();
    }
    // siempre quitar la copia local (lugar local o edición guardada offline)
    const habiaCopiaLocal = local.lugares.some(
      (x) => x.place_id === l.place_id
    );
    for (const id of [...hijos, l.place_id]) local.deleteLugar(id);
    if (isLocalId(l.place_id)) {
      setMsg(null);
      if (!silencioso) toast.success(tx("workspace.local_place_deleted"));
      return true;
    }
    // en el servidor, la geocerca se lleva sus interiores; una interior se
    // quita editando su geocerca (es una versión de ella)
    const padreId = parentPlaceId(l);
    const res = padreId
      ? await quitarInteriores(padreId, [l.place_id])
      : await borrarPlace(codigoGuardado(l.place_id), tx);
    setMsg(null);
    if (silencioso) return borradoOk(res);
    avisarBorrado(tx, res, "lugar", habiaCopiaLocal);
    refrescarTodo();
    return borradoOk(res);
  };

  const editarTrayecto = (t: Trayecto) => {
    if (!puedeEditar) return;
    setMenu(null);
    setModo("trayecto");
    setMsg(null);
    setPuntoMapaId(null);
    setPasoTrayecto("recorrido");
    const pts = (t.waypoints?.length ? t.waypoints : t.points) ?? [];
    const abierto: FormTrayecto = {
      ...TRAY_VACIO,
      id: t.trayecto_id,
      name: t.name,
      icon: t.icon ?? "",
      kind: (t.kind as "vial" | "interno") ?? "vial",
      width_m: t.width_m ?? 30,
      external_id: t.external_id ?? "",
      categorias: t.categorias ?? [],
      categorias_lista: t.categorias_lista ?? null,
      categorias_puntos_lista: t.categorias_puntos_lista ?? null,
      pts,
      ajustado: !!t.ajustado,
      vias: [],
      recorrido: recorridoDesdePts(
        pts,
        t.tipos_puntos ?? [],
        t.categorias_puntos ?? []
      ),
      confirmado: pts.length >= 2,
    };
    trayOriginal.current = abierto;
    inicialTray.current = abierto;
    setTray(abierto);
    setTrayPathAjustado(t.ajustado && t.waypoints?.length ? t.points : null);
    // punto medio del recorrido, no su inicio
    centrarEnVista(t.points[Math.floor(t.points.length / 2)] ?? null);
  };

  // ── Trayecto por dirección: A → B escritos, ruta por calles automática ──
  const centroMapa = useCallback((): [number, number] | null => {
    const c = mapRef.current?.getCenter();
    return c ? [c.lat, c.lng] : null;
  }, [mapRef]);

  const encuadrarRuta = (pts: [number, number][]) => {
    const map = mapRef.current;
    if (!map || pts.length === 0) return;
    const margen = 60;
    // rutas muy largas (entre continentes): encuadrarCaja evita el centro
    // NaN que da el fitBounds de Mapbox en el globo
    encuadrarCaja(map, cajaDePuntos(pts), {
      margen: {
        top: margen,
        bottom: margen,
        left: margen,
        right: margen,
      },
      maxZoom: MAX_ZOOM_CREAR,
      duration: 800,
    });
  };

  // el nombre lo escribe el usuario: trazar no lo completa
  const trazarRuta = async (
    pts: [number, number][],
    kind = tray.kind,
    tipos: TipoPunto[] = tiposUbicados(tray)
  ) => {
    const seq = ++rutaSeq.current;
    setTray((t) => ({ ...t, pts, ajustado: false }));
    setTrayPathAjustado(null);
    if (kind !== "vial" || !MAPBOX_TOKEN) {
      encuadrarRuta(pts);
      return;
    }
    setGuardando(true);
    const aj = await ajustarACalles(pts, MAPBOX_TOKEN, tipos);
    if (seq !== rutaSeq.current) return;
    setGuardando(false);
    if (!aj) {
      setMsg(tx("workspace.no_street_route"));
      encuadrarRuta(pts);
      return;
    }
    setTray((t) => ({ ...t, ajustado: true, vias: aj.vias }));
    setTrayPathAjustado(aj.pts);
    encuadrarRuta(aj.pts);
  };

  /** El recorrido cambió: la ruta trazada (o en camino) ya no vale. */
  const descartarRuta = useCallback(() => {
    rutaSeq.current++; // ignora una ruta que estuviera en camino
    setGuardando(false);
    setTrayPathAjustado(null);
    setMsg(null);
  }, []);

  /**
   * Aplica un cambio al recorrido A → paradas → B. La ruta no se traza hasta
   * confirmar: mientras tanto se ve la línea entre puntos. `foco` = punto
   * elegido por dirección: el mapa se acerca a ese punto (nivel de calle).
   */
  const aplicarRecorrido = (
    cambio: (t: FormTrayecto) => FormTrayecto,
    foco?: [number, number]
  ) => {
    const next = cambio(tray);
    if (next === tray) return;
    setTray(next);
    descartarRuta();
    // dirección elegida en el buscador: acercar el mapa a ese punto
    if (foco) acercarADireccion(foco);
  };

  /** Listo: traza la ruta por los puntos del recorrido. */
  const confirmarTrayecto = () => {
    const pts = puntosRecorrido(tray);
    if (tray.confirmado || !pts) return;
    setPuntoMapaId(null);
    setTray(confirmarRecorrido);
    void trazarRuta(pts);
  };
  /**
   * Cambia de pestaña. Al pasar a la información, un recorrido completo sin
   * confirmar se confirma (se traza la ruta) y el mapa deja de editarse.
   */
  const cambiarPasoTrayecto = (paso: PasoTrayecto) => {
    if (paso === pasoTrayecto) return;
    setMsg(null);
    if (paso === "datos") {
      confirmarTrayecto();
      setPuntoMapaId(null);
      setHoverPuntoId(null);
    }
    setPasoTrayecto(paso);
  };
  /**
   * Botón guardar del formulario, como un stepper: lleva a la pestaña donde
   * falta algo. Sin origen y destino, al trayecto; desde el trayecto, a la
   * información; sin nombre o External ID, se queda ahí (el formulario marca el
   * campo).
   */
  const guardarOContinuarTrayecto = () => {
    if (!puntosRecorrido(tray)) {
      cambiarPasoTrayecto("recorrido");
      setMsg(tx("workspace.place_origin_destination"));
      return;
    }
    if (pasoTrayecto === "recorrido") {
      cambiarPasoTrayecto("datos");
      return;
    }
    if (!tray.name.trim()) {
      setMsg(tx("workspace.route_name_missing"));
      return;
    }
    if (faltaExternalIdTrayecto(tray)) {
      setMsg(tx("validation.code_missing"));
      return;
    }
    void guardarTrayecto();
  };
  /**
   * Parada o desvío de un punto. Con la ruta ya trazada se vuelve a pedir:
   * un desvío es punto de paso y la ruta puede cambiar.
   */
  const cambiarTipoPuntoTray = (id: string, tipo: TipoPunto) => {
    const next = cambiarTipoPunto(tray, id, tipo);
    if (next === tray) return;
    setTray(next);
    const pts = puntosRecorrido(next);
    if (next.confirmado && pts)
      void trazarRuta(pts, next.kind, tiposUbicados(next));
  };
  /** Vial sigue calles e interno va en línea recta: con ruta, se vuelve a trazar. */
  const cambiarTipoTrayecto = (kind: FormTrayecto["kind"]) => {
    if (kind === tray.kind) return;
    setTray((t) => ({ ...t, kind }));
    const pts = puntosRecorrido(tray);
    if (tray.confirmado && pts) void trazarRuta(pts, kind);
  };
  const deshacerTrayecto = () => aplicarRecorrido(deshacerRecorrido);
  const rehacerTrayecto = () => aplicarRecorrido(rehacerRecorrido);
  const editarPuntosTrayecto = () => aplicarRecorrido(editarRecorrido);
  const borrarPuntosTrayecto = () => {
    // Esc con "ubicar en el mapa" activo solo cancela eso
    if (puntoMapaId) {
      setPuntoMapaId(null);
      return;
    }
    aplicarRecorrido(borrarRecorrido);
  };

  const elegirPuntoEnMapa = useCallback((id: string) => {
    setPuntoMapaId((cur) => (cur === id ? null : id));
  }, []);

  const ubicarPuntoEnRecorrido = (id: string, punto: LatLon) => {
    setPuntoMapaId(null);
    aplicarRecorrido((t) =>
      puntoDesdeMapa(t, id, punto, textoDesdeCoords(punto))
    );
    rotularPuntoSiSigue(id, punto);
  };

  const guardarTrayecto = async () => {
    // algo mal (recorrido, nombre, ancho): no se guarda
    const error = errorTrayecto(tray, tx);
    if (error) {
      setMsg(error);
      return;
    }
    if (bloqueaCodigo(estadoCodigoTrayecto)) return;
    const orig = trayOriginal.current;
    const id = idGuardado(tray.id);
    // toda edición es una versión: sin cambios no hay nada que guardar
    if (id) {
      const cambios = orig
        ? cambiosTrayecto(orig, tray, tx)
        : [edicionSinOriginal(tx)];
      pedirVersion("trayecto", id, tray.name, cambios);
      return;
    }
    await persistirTrayecto(null);
  };

  const persistirTrayecto = async (version: NuevaVersion | null) => {
    setGuardando(true);
    // uno de prueba de este navegador o uno anterior (PT4) se guarda como nuevo
    const id = version ? idGuardado(tray.id) : null;
    const res = await guardarConTipos(id, {
      ...requestDesdeTrayecto(
        trayectoDesdeForm(tray, trayPathAjustado, id ?? "")
      ),
      version: version ? aVersionRequest(version) : undefined,
    });
    setGuardando(false);
    if (res === null) {
      toast.error(tx("workspace.save_no_server"));
      return;
    }
    if (!res.ok) {
      toast.error(tx("workspace.not_saved", { error: res.error }));
      return;
    }
    if (tray.id) local.deleteTrayecto(tray.id);
    setMsg(null);
    toast.success(
      id ? tx("workspace.route_updated") : tx("workspace.route_saved")
    );
    setTray({ ...TRAY_VACIO });
    setTrayPathAjustado(null);
    setModo("ver");
    refrescarTodo();
  };

  const borrarTrayecto = (t: Trayecto) => {
    if (!puedeEditar) return;
    confirmar(
      tx("workspace.delete_route"),
      t.name,
      () => void eliminarTrayecto(t)
    );
  };

  const eliminarTrayecto = async (t: Trayecto, silencioso = false) => {
    if (modo === "trayecto" && tray.id === t.trayecto_id) cerrarForm();
    const habiaCopiaLocal = local.trayectos.some(
      (x) => x.trayecto_id === t.trayecto_id
    );
    local.deleteTrayecto(t.trayecto_id);
    if (isLocalId(t.trayecto_id)) {
      setMsg(null);
      if (!silencioso) toast.success(tx("workspace.local_route_deleted"));
      return true;
    }
    const res = await borrarPlace(codigoGuardado(t.trayecto_id), tx);
    setMsg(null);
    if (silencioso) return borradoOk(res);
    avisarBorrado(tx, res, "trayecto", habiaCopiaLocal);
    refrescarTodo();
    return borradoOk(res);
  };

  /**
   * Borrar varios elegidos en la lista, con una sola confirmación y un solo
   * aviso. Los interiores cuyo lugar también se borra no van aparte: se
   * borran con él.
   */
  /** Las interiores guardadas aparte: se quitan editando su geocerca. */
  const separarInteriores = (ls: Lugar[]) => {
    const esInterior = (l: Lugar) =>
      Boolean(parentPlaceId(l)) && !isLocalId(l.place_id);
    return {
      interiores: ls.filter(esInterior),
      resto: ls.filter((l) => !esInterior(l)),
    };
  };

  /**
   * Interiores de un lote: una edición (una versión) por geocerca, con todas
   * las suyas, para que la segunda no choque con la primera.
   */
  const eliminarInterioresEnLote = async (
    interiores: Lugar[]
  ): Promise<boolean[]> => {
    const porPadre = new Map<string, string[]>();
    for (const l of interiores) {
      const padre = parentPlaceId(l) ?? "";
      porPadre.set(padre, [...(porPadre.get(padre) ?? []), l.place_id]);
    }
    const resultados = await enSerie([...porPadre], async ([padre, ids]) => {
      const ok = borradoOk(await quitarInteriores(padre, ids));
      if (ok) for (const id of ids) local.deleteLugar(id);
      return ids.map(() => ok);
    });
    return resultados.flat();
  };

  const borrarSeleccion = (
    lugaresSel: Lugar[],
    trayectosSel: Trayecto[],
    alTerminar?: () => void
  ) => {
    if (!puedeEditar) return;
    // las de StreamHub no se eliminan desde aquí: quedan fuera de la selección
    const editables = lugaresSel.filter((l) => !esDeStreamhub(l.place_id));
    if (editables.length < lugaresSel.length) {
      toast.info(tx("workspace.streamhub_not_deleted"));
    }
    const ids = new Set(editables.map((l) => l.place_id));
    const sueltos = editables.filter((l) => {
      const padre = parentPlaceId(l);
      return !padre || !ids.has(padre);
    });
    const total = sueltos.length + trayectosSel.length;
    if (total === 0) return;
    confirmar(
      total === 1
        ? tx("workspace.delete_items_one")
        : tx("workspace.delete_items_many", { n: total }),
      resumenSeleccion(sueltos.length, trayectosSel.length, tx),
      () =>
        void (async () => {
          const { interiores, resto } = separarInteriores(sueltos);
          const okLugares = [
            ...(await enSerie(resto, (l) => eliminarLugar(l, true))),
            ...(await eliminarInterioresEnLote(interiores)),
          ];
          const okTrayectos = await enSerie(trayectosSel, (t) =>
            eliminarTrayecto(t, true)
          );
          const fallidos = [...okLugares, ...okTrayectos].filter(
            (ok) => !ok
          ).length;
          refrescarTodo();
          alTerminar?.();
          avisarBorradoLote(tx, total, fallidos);
        })()
    );
  };

  // ── Importación masiva ──
  const onArchivos = async (files: File[]) => {
    if (!puedeEditar) return;
    let leidos: { file: File; formato: string; filas: FilaImport[] }[];
    try {
      leidos = await enSerie(files, async (file) => ({
        file,
        ...(await parsearArchivoLugares(file, tx)),
      }));
    } catch {
      setMsg(tx("workspace.file_unreadable"));
      return;
    }
    const vacio = leidos.some((l) => l.filas.length === 0);
    const nuevos: LoteImport[] = leidos
      .filter((l) => l.filas.length > 0)
      .map(({ file, formato, filas }) => ({
        filename: file.name,
        formato,
        filas: conUid(filas, file.name),
      }));
    if (!nuevos.length) {
      if (vacio) setMsg(tx("workspace.import_empty"));
      return;
    }
    setImp((s) => {
      const keep = (s.lotes ?? []).filter(
        (l) => !nuevos.some((n) => n.filename === l.filename)
      );
      return { ...s, lotes: [...keep, ...nuevos], resultado: null };
    });
  };

  /** Trayecto de una fila importada (nuevo o reemplazando a `trayectoId`). */
  const trayectoDeFila = (fila: FilaImport, trayectoId: string): Trayecto => ({
    trayecto_id: trayectoId,
    name: fila.name,
    kind: fila.kind ?? "vial",
    width_m: fila.width_m ?? TRAY_VACIO.width_m,
    points: fila.points ?? fila.waypoints ?? [],
    waypoints: fila.waypoints ?? null,
    parent_name: null,
    ajustado: fila.ajustado ?? false,
    external_id: fila.external_id ?? null,
    tipos_puntos: fila.tipos_puntos ?? null,
    categorias_puntos: fila.categorias_puntos ?? null,
    categorias_puntos_lista: fila.categorias_puntos_selectable ?? null,
  });

  /** Guarda un trayecto importado; sin servidor, queda rechazado. */
  const guardarTrayectoImport = async (
    fila: FilaImport,
    trayectoId: string | null,
    datos: Guardados
  ): Promise<boolean> => {
    const id = idGuardado(trayectoId);
    const antes = id
      ? datos.trayectos.find((t) => t.trayecto_id === id)
      : undefined;
    if (antes?.categorias?.length && !antes.categorias_lista?.trim())
      return false;
    // el archivo no trae ícono ni categorías: al reemplazar, quedan los guardados
    const body = requestDesdeTrayecto({
      ...trayectoDeFila(fila, id ?? ""),
      icon: antes?.icon ?? null,
      categorias: antes?.categorias ?? null,
      categorias_lista: antes?.categorias_lista ?? null,
      external_id: fila.external_id || antes?.external_id || null,
    });
    const res = await guardarConTipos(
      id,
      {
        ...body,
        version: antes
          ? versionAutomatica(
              bumpDeReemplazo(requestDesdeTrayecto(antes), body),
              tx("workspace.updated_by_import"),
              tx("workspace.replaced_with_file")
            )
          : undefined,
      },
      datos.metadatos
    );
    if (!escrituraOk(res)) return false;
    // uno de prueba de este navegador ya está en el servidor
    if (trayectoId && isLocalId(trayectoId)) local.deleteTrayecto(trayectoId);
    return true;
  };

  // ── Gestor de conflictos del import ──
  const decidirImport = (uid: string, decision: DecisionImport) =>
    setImp((s) => ({
      ...s,
      decisiones: { ...s.decisiones, [uid]: decision },
    }));
  const alternarSeleccionImport = (uid: string) =>
    setImp((s) => ({
      ...s,
      seleccion: s.seleccion.includes(uid)
        ? s.seleccion.filter((x) => x !== uid)
        : [...s.seleccion, uid],
    }));
  const seleccionarTodoImport = (todo: boolean) =>
    setImp((s) => ({
      ...s,
      seleccion: todo ? filasImp.map((f) => f.uid) : [],
    }));
  /** Marca o desmarca varias filas (p. ej. todas las de un archivo). */
  const marcarFilasImport = (uids: string[], marcar: boolean) =>
    setImp((s) => {
      const resto = s.seleccion.filter((u) => !uids.includes(u));
      return { ...s, seleccion: marcar ? [...resto, ...uids] : resto };
    });
  /** Quita filas del import (los archivos que quedan vacíos también). */
  const quitarFilasImport = (uids: string[]) => {
    const fuera = new Set(uids);
    if (hoverImportUid && fuera.has(hoverImportUid)) setHoverImportUid(null);
    setImp((s) => ({
      ...s,
      lotes: s.lotes
        .map((l) => ({
          ...l,
          filas: l.filas.filter((f) => !f.uid || !fuera.has(f.uid)),
        }))
        .filter((l) => l.filas.length > 0),
      seleccion: s.seleccion.filter((u) => !fuera.has(u)),
    }));
  };
  /** Encuadra estos puntos dejando libre la ventana flotante. */
  const encuadrarPuntos = (pts: LatLon[]) => {
    const map = mapRef.current;
    if (!map || pts.length === 0) return;
    const margen = 60;
    encuadrarCaja(map, cajaDePuntos(pts), {
      margen: {
        top: margen,
        bottom: margen,
        left: margen,
        right: margen,
      },
      maxZoom: 17,
      duration: 500,
    });
  };

  /** Hover en una fila: se resalta y el mapa se acerca a su geocerca. */
  const hoverFilaImport = (uid: string | null) => {
    setHoverImportUid(uid);
    setHoverConflictoId(null);
    const fila = uid ? filasImp.find((f) => f.uid === uid) : undefined;
    if (fila) encuadrarPuntos(contorno(formaDeFila(fila)));
  };

  /** Forma de aquello con lo que choca una fila (guardado u otra fila). */
  const formaDelConflicto = (c: ConflictoImport) => {
    if (c.con.tipo === "lugar") return formaDeLugar(c.con.lugar);
    if (c.con.tipo === "trayecto") return formaDeTrayecto(c.con.trayecto);
    const uidOtra = c.con.uid;
    const f = filasImp.find((x) => x.uid === uidOtra);
    return f ? formaDeFila(f) : null;
  };

  /**
   * Hover en un conflicto: se ven las dos geocercas, la importada y la que
   * choca con ella (guardada u otra fila), y el mapa encuadra ambas.
   */
  const hoverConflictoImport = (uid: string, c: ConflictoImport | null) => {
    if (!c) {
      setHoverConflictoId(null);
      return;
    }
    const fila = filasImp.find((f) => f.uid === uid);
    if (!fila) return;
    const otra = formaDelConflicto(c);
    setHoverImportUid(uid);
    setHoverConflictoId(idConflicto(c));
    encuadrarPuntos([
      ...contorno(formaDeFila(fila)),
      ...(otra ? contorno(otra) : []),
    ]);
  };

  /** "Usar nuevo" contra un lugar guardado: toma la forma y datos importados. */
  const reemplazarConFila = async (
    l: Lugar,
    fila: FilaImport,
    datos: Guardados
  ): Promise<boolean> => {
    if (esDeStreamhub(l.place_id)) return false;
    l = datos.lugares.find((p) => p.place_id === l.place_id) ?? l;
    const poly = filaEsPoligono(fila);
    const radio = poly
      ? null
      : (fila.radius_m ?? l.radius_m ?? FORM_VACIO.radius_m);
    // un código guardado no cambia: el archivo no lo reemplaza
    const codigo = codigoDeLugar(l.place_id) || fila.external_id;
    const nuevo: Lugar = {
      ...l,
      name: fila.name,
      address: fila.address ?? l.address,
      external_id: codigo || l.external_id,
      geometry_type: poly ? "polygon" : "circle",
      center: [fila.lat, fila.lon],
      polygon: poly ? (fila.vertices ?? []) : null,
      radius_m: radio,
    };
    const res = await guardarReemplazo(l, nuevo, datos);
    if (!escrituraOk(res)) return false;
    // uno de prueba de este navegador ya está en el servidor
    if (isLocalId(l.place_id)) quitarCopiasLocales(l.place_id);
    return true;
  };

  /**
   * Guarda lo que trae el archivo en lugar de `l`: nuevo si no estaba guardado;
   * si no, una versión de la geocerca (o de la geocerca de la interior).
   */
  const guardarReemplazo = async (
    l: Lugar,
    nuevo: Lugar,
    datos: Guardados
  ): Promise<Escritura | null> => {
    if (categoriasDeLugar(nuevo).length && !listaDeLugar(nuevo)?.trim())
      return { ok: false, error: tx("validation.category_list_missing") };
    const id = idGuardado(l.place_id);
    const padreId = parentPlaceId(nuevo);
    if (padreId) return reemplazarInterior(padreId, id, nuevo, l, datos);
    if (!id) return guardarConTipos(null, requestDesdeLugar(nuevo, null));
    return guardarConTipos(
      id,
      {
        ...requestDesdeGeocerca(
          nuevo,
          interioresGuardadasDe(id, datos.lugares)
        ),
        version: versionAutomatica(
          bumpDeReemplazo(
            requestDesdeLugar(l, null),
            requestDesdeLugar(nuevo, null)
          ),
          tx("workspace.updated_by_import"),
          tx("workspace.replaced_with_file")
        ),
      },
      datos.metadatos
    );
  };

  /** Una interior del archivo: una versión de su geocerca, que la agrega o reemplaza. */
  const reemplazarInterior = async (
    padreId: string,
    id: string | null,
    nuevo: Lugar,
    antes: Lugar,
    datos: Guardados
  ): Promise<Escritura | null> => {
    const padre = datos.lugares.find((p) => p.place_id === padreId);
    if (!padre || !idGuardado(padreId)) {
      return { ok: false, error: tx("workspace.parent_not_saved") };
    }
    const guardadas = interioresGuardadasDe(padreId, datos.lugares);
    const interiores = id
      ? guardadas.map((h) => (h.id === id ? { lugar: nuevo, id } : h))
      : [...guardadas, { lugar: nuevo, id: null }];
    const version = id
      ? versionAutomatica(
          bumpDeReemplazo(
            requestDesdeLugar(antes, null),
            requestDesdeLugar(nuevo, null)
          ),
          tx("workspace.updated_by_import"),
          tx("workspace.inner_replaced_with_file", { nombre: nuevo.name })
        )
      : versionAutomatica(
          "MINOR",
          tx("workspace.added_by_import"),
          tx("workspace.inner_added", { nombre: nuevo.name })
        );
    return guardarConTipos(
      padreId,
      {
        ...requestDesdeGeocerca(padre, interiores),
        version,
      },
      datos.metadatos
    );
  };

  /** Las interiores guardadas de una geocerca, como van en su escritura. */
  const interioresGuardadasDe = (
    padreId: string,
    lugares: Lugar[]
  ): InteriorGuardable[] =>
    lugares
      .filter((x) => parentPlaceId(x) === padreId && !isLocalId(x.place_id))
      .map((h) => ({ lugar: h, id: h.place_id }));

  /** Otro lugar guardado que la fila nueva reemplaza (con sus interiores). */
  const quitarReemplazado = async (
    l: Lugar,
    datos: Guardados
  ): Promise<boolean> => {
    if (esDeStreamhub(l.place_id)) return false;
    if (isLocalId(l.place_id)) {
      quitarCopiasLocales(l.place_id);
      return true;
    }
    // Deleting a parent already removed its children.
    if (!datos.lugares.some((p) => p.place_id === l.place_id)) return true;
    // en el servidor, la geocerca se lleva sus interiores; una interior se
    // quita editando su geocerca
    const padreId = parentPlaceId(l);
    const res = padreId
      ? await quitarInteriores(
          padreId,
          [l.place_id],
          datos.lugares,
          datos.metadatos
        )
      : await borrarPlace(codigoGuardado(l.place_id), tx);
    if (escrituraOk(res)) quitarCopiasLocales(l.place_id);
    return escrituraOk(res);
  };

  /** Una geocerca importada, nueva: en el servidor o rechazada. */
  const crearLugarImport = async (fila: FilaImport): Promise<boolean> => {
    const lugar = lugarDesdeFilaImport(fila, [], "", null);
    const res = await guardarConTipos(null, requestDesdeLugar(lugar, null));
    return escrituraOk(res);
  };

  const confirmarImport = async () => {
    if (!puedeEditar || guardando) return;
    setGuardando(true);
    try {
      const resultado = await ejecutarImport(
        planImport(filasImp, conflictosImp, imp.decisiones),
        {
          refrescar: async () => {
            if (workspaceScope.current !== storageScope)
              throw new Error("The active organization changed during import");
            const datos = await refG();
            if (workspaceScope.current !== storageScope)
              throw new Error("The active organization changed during import");
            if (!datos) throw new Error("Saved places could not be refreshed");
            return {
              ...datos,
              lugares: fusionarPorId(
                local.lugares,
                datos.lugares,
                (l) => l.place_id
              ),
            };
          },
          crearLugar: crearLugarImport,
          guardarTrayecto: guardarTrayectoImport,
          reemplazarLugar: reemplazarConFila,
          quitarLugar: quitarReemplazado,
        }
      );
      setHoverImportUid(null);
      setImp((s) => ({
        ...s,
        resultado: textoResultadoImport(resultado, tx),
        lotes: [],
        decisiones: {},
        seleccion: [],
      }));
    } catch {
      if (workspaceScope.current === storageScope)
        setMsg(tx("workspace.import_refresh_failed"));
    } finally {
      setGuardando(false);
      refrescarTodo();
    }
  };

  const abrirImport = () => {
    if (!puedeEditar) return;
    setMenu(null);
    setHoverImportUid(null);
    setHoverConflictoId(null);
    if (modo === "import") {
      setImp({ ...IMP_VACIO });
      setModo("ver");
    } else {
      setImp({ ...IMP_VACIO });
      setModo("import");
    }
    setMsg(null);
  };

  return {
    /** Los textos de Lugares en el idioma de la página. */
    t: tx,
    storageScope,
    MAPBOX_TOKEN,
    mapStyle,
    setMapStyle,
    busca,
    setBusca,
    modo,
    setModo,
    form,
    setForm,
    pasoLugar,
    hoveredPlaceId,
    setHoveredPlaceId,
    tray,
    setTray,
    menu,
    setMenu,
    imp,
    setImp,
    filasImp,
    conflictosImp,
    fcImport,
    importando,
    nombresImport,
    hoverImportUid,
    hoverFilaImport,
    hoverConflictoId,
    hoverConflictoImport,
    decidirImport,
    alternarSeleccionImport,
    seleccionarTodoImport,
    marcarFilasImport,
    quitarFilasImport,
    trayPathAjustado,
    msg,
    confirmacion,
    setConfirmacion,
    confirmar,
    guardando,
    propios,
    trayectos,
    local,
    todosLugares,
    todosTrayectos,
    lugares,
    editandoLugarId,
    editandoTrayId,
    fcPropios,
    fcTray,
    prevLugarFC,
    prevTrayRawFC,
    prevTrayAdjFC,
    onMapContextMenu,
    onHoverNombre,
    tooltipBadge,
    onHoverBadge,
    menuLugar,
    cerrarMenuLugar,
    configurarDesdeMenu,
    eliminarDesdeMenu,
    onMapClick,
    clicAgrega,
    crearLugarAqui,
    crearTrayectoAqui,
    nuevoLugar,
    nuevoTrayecto,
    cerrarMenu,
    terminarPoligono,
    deshacerPunto,
    rehacerPunto,
    seguirPoligono,
    cancelarPoligono,
    cerrarForm,
    restaurarBorrador,
    cierrePendiente,
    pedirCerrarForm,
    pedirSalir,
    seguirEditando,
    salirSinGuardar,
    continuarAInteriores,
    volverAGeocerca,
    irALugar,
    irATrayecto,
    irAPunto,
    editarLugar,
    guardarLugar,
    puedeEditar,
    borrarSeleccion,
    versionPendiente,
    confirmarVersion,
    cancelarVersion,
    versionDe,
    codigoDeLugar,
    estadoCodigoLugar,
    estadoCodigoTrayecto,
    estadosCodigoInteriores,
    codigoInteriorFijo,
    borrarLugar,
    editarTrayecto,
    centroMapa,
    ubicarEnMapa: (punto: LatLon, radioM: number) =>
      ubicarPuntoEnMapa(punto, radioM, encuadrarCirculo),
    aplicarRecorrido,
    descartarRuta,
    rotularPuntoSiSigue,
    confirmarTrayecto,
    pasoTrayecto,
    cambiarPasoTrayecto,
    guardarOContinuarTrayecto,
    cambiarTipoTrayecto,
    cambiarTipoPuntoTray,
    hoverPuntoId,
    setHoverPuntoId,
    deshacerTrayecto,
    rehacerTrayecto,
    editarPuntosTrayecto,
    borrarPuntosTrayecto,
    puntoMapaId,
    elegirPuntoEnMapa,
    distanciaTrayectoM,
    guardarTrayecto,
    borrarTrayecto,
    onArchivos,
    confirmarImport,
    fileRef,
    abrirImport,
  };
}

export type PlacesWorkspace = ReturnType<typeof usePlacesWorkspace>;

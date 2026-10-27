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
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";
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
  TRAY_VACIO,
  type Categoria,
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
  colorDeFormLugar,
  colorDeLugar,
  iconoDeLugar,
  metadataAFilas,
  metadataParaGuardar,
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
  payloadInner,
  puntoDentroDelPadre,
} from "../geofences/inner-geofences";
import {
  fusionarPorId,
  isLocalId,
  lugarDesdeForm,
  newLocalId,
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
  cambiosLugar,
  cambiosTrayecto,
  nextVersion,
  type CambioVersion,
  type VersionBump,
} from "../versioning/versioning";
import {
  useVersionesPlaces,
  type TipoVersionado,
} from "../versioning/versions-store";
import type { VersionPendiente } from "../versioning/version-dialog";
import { resumenSeleccion } from "../catalog/list-selection";
import { enSerie } from "../data/en-serie";
import {
  borrarBorrador,
  guardarBorrador,
  leerBorrador,
  type AmbitoBorrador,
  type Borrador,
} from "../data/draft-store";
import { cambioLugar, cambioTrayecto } from "../data/form-changes";
import {
  LUGARES_EN_LOCAL,
  URL_GEOCERCAS,
  esDeStreamhub,
} from "../data/streamhub-geofences";
import { errorLugar } from "../geofences/place-validation";
import { errorTrayecto } from "../routes/trayecto-validation";

/** Versión elegida en el diálogo, que se anota al guardar bien. */
type NuevaVersion = {
  tipo: TipoVersionado;
  id: string;
  actual: string;
  bump: VersionBump;
  descripcion: string;
  cambios: CambioVersion[];
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
const post = (fn: string, body: Record<string, unknown>) =>
  fetch(`/app/api/atc/rpc/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
// Como post, pero null cuando el backend no responde (red caída o HTTP != 2xx):
// el llamador cae al respaldo local.
const tryPost = async (fn: string, body: Record<string, unknown>) => {
  try {
    const r = await fetch(`/app/api/atc/rpc/${fn}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};
// Resultado de un borrado en el servidor; null = el servidor no respondió.
function mensajeBorrado(
  res: { ok?: boolean; detalle?: string; error?: string } | null,
  que: "Lugar" | "Trayecto",
  habiaCopiaLocal: boolean
): string {
  if (res === null)
    return habiaCopiaLocal
      ? `${que} quitado de este navegador; el servidor no respondió, puede volver a aparecer.`
      : "No se pudo eliminar: el servidor no respondió.";
  if (res.ok === false) return `No eliminado — ${res.detalle ?? res.error}`;
  return `${que} eliminado.`;
}

/** Resultado de borrar como toast: éxito, aviso (solo local) o error. */
const borradoOk = (res: { ok?: boolean } | null): boolean =>
  res !== null && res.ok !== false;

function avisarBorradoLote(total: number, fallidos: number) {
  if (fallidos === 0) {
    toast.success(
      total === 1 ? "1 elemento eliminado." : `${total} elementos eliminados.`
    );
    return;
  }
  const ok = total - fallidos;
  toast.error(
    `${ok} de ${total} eliminados; ${fallidos} no se pudieron eliminar en el servidor.`
  );
}

function avisarBorrado(
  res: { ok?: boolean; detalle?: string; error?: string } | null,
  que: "Lugar" | "Trayecto",
  habiaCopiaLocal: boolean
) {
  const texto = mensajeBorrado(res, que, habiaCopiaLocal);
  if (res !== null && res.ok !== false) toast.success(texto);
  else if (res === null && habiaCopiaLocal) toast.warning(texto);
  else toast.error(texto);
}

/** Resultado de guardar como toast (no como texto sobre las tarjetas). */
function avisarGuardado(ok: boolean, okMsg: string) {
  if (!ok) {
    toast.error(
      "No se pudo guardar localmente (almacenamiento lleno o bloqueado)."
    );
    return;
  }
  if (okMsg === MSG_LOCAL) toast.warning(okMsg);
  else toast.success(okMsg);
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

const MSG_LOCAL =
  "Servidor no disponible — guardado localmente en este navegador.";

type Cuota = { usadas: number; limite: number };

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

function fcLugares(lugares: Lugar[], propios: boolean): FeatureCollection {
  const features: Feature[] = [];
  for (const l of lugares) {
    if (!l.center && !l.polygon) continue;
    const ring: [number, number][] = l.polygon
      ? anilloGeoJSON(l.polygon)
      : circuloPoly(l.center![0], l.center![1], l.radius_m ?? 250);
    features.push({
      type: "Feature",
      properties: {
        name: l.name.trim() || "Lugar",
        color: colorDeLugar(l, propios ? "#1C64F2" : "#6B7280"),
        place_id: l.place_id,
        inner: Boolean(parentPlaceId(l)),
        parent_id: parentPlaceId(l),
        radius_m: radioLugarM(l),
        icon: iconoDeLugar(l) ?? "",
      },
      geometry: { type: "Polygon", coordinates: [ring] } as Polygon,
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

const MSG_IMPORT_VACIO =
  "El archivo no tiene filas válidas (CSV, KML o GeoJSON con puntos o polígonos).";

// Mapbox simplifica GeoJSON al alejar el zoom (tolerance 0.375 por defecto):
// círculos chicos y polígonos detallados pierden vértices y dejan de coincidir
// con la geocerca real. 0 = dibujar siempre los vértices exactos.
export const GEOJSON_EXACTO = 0;

const IMP_VACIO = {
  lotes: [] as LoteImport[],
  catDef: "",
  resultado: null as string | null,
  /** Gestor de conflictos: decisión por fila (uid) y filas marcadas. */
  decisiones: {} as Record<string, DecisionImport>,
  seleccion: [] as string[],
};

let secuenciaImport = 0;
/** Id estable por fila: sobrevive a quitar filas o a otro archivo. */
const conUid = (filas: FilaImport[], archivo: string): FilaImport[] =>
  filas.map((f) => ({ ...f, uid: `${archivo}#${++secuenciaImport}` }));

/** El servidor recibe la fila tal cual el archivo, sin el uid del gestor. */
function sinUid(f: FilaImport): FilaImport {
  const copia = { ...f };
  delete copia.uid;
  return copia;
}

/** Forma que se está dibujando: la geocerca o una de sus interiores. */
type FormaPrevia = Pick<
  InnerGeofence,
  "geom" | "lat" | "lon" | "radius_m" | "vertices" | "cerrado"
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

/** Dónde quedó una fila importada. */
type DestinoImport = "servidor" | "local" | "rechazada";

type ConteoImport = { creadas: number; locales: number; rechazadas: number };
const CONTEO_VACIO: ConteoImport = { creadas: 0, locales: 0, rechazadas: 0 };

function contarDestinos(ds: DestinoImport[]): ConteoImport {
  const n = (d: DestinoImport) => ds.filter((x) => x === d).length;
  return {
    creadas: n("servidor"),
    locales: n("local"),
    rechazadas: n("rechazada"),
  };
}

/** "Importadas 3 · actualizadas 1 · rechazadas 0" (solo lo que pasó). */
export function textoResultadoImport(r: {
  creadas: number;
  actualizadas: number;
  reemplazadas: number;
  locales: number;
  rechazadas: number;
}): string {
  const partes = [`Importadas ${r.creadas}`];
  if (r.actualizadas) partes.push(`actualizadas ${r.actualizadas}`);
  if (r.reemplazadas) partes.push(`reemplazadas ${r.reemplazadas}`);
  if (r.locales) partes.push(`locales ${r.locales}`);
  partes.push(`rechazadas ${r.rechazadas}`);
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
  }
) {
  const enabled = options?.enabled ?? true;
  const puedeEditar = options?.puedeEditar ?? true;
  const ambito = options?.ambito ?? "geografico";
  const runtimeConfig = useRuntimeConfig();
  const MAPBOX_TOKEN = runtimeConfig?.MAPBOX_API_KEY;
  const { carrierMode } = useCarrierMode();
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
  // versionado: cómo estaba el elemento al abrirlo, para listar qué cambió
  const versiones = useVersionesPlaces();
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

  // geocercas: de StreamHub (antes fn_pt4_places); trayectos, categorías y
  // cuotas siguen en PT4
  const { data: propios, mutate: refP } = useSWR<Lugar[]>(
    enabled ? URL_GEOCERCAS : null,
    fetcher
  );
  const { data: globales } = useSWR<Lugar[]>(
    enabled && carrierMode ? "/app/api/atc/rpc/fn_pt4_places_global" : null,
    fetcher
  );
  const { data: trayectos, mutate: refT } = useSWR<Trayecto[]>(
    enabled ? "/app/api/atc/rpc/fn_pt4_trayectos" : null,
    fetcher
  );
  const { data: cats } = useSWR<Categoria[]>(
    enabled ? "/app/api/atc/rpc/fn_pt4_categorias" : null,
    fetcher
  );
  const { data: cuotas, mutate: refQ } = useSWR<{
    lugares: Cuota;
    trayectos: Cuota;
  }>(
    enabled && carrierMode ? "/app/api/atc/rpc/fn_pt4_quota_status" : null,
    fetcher
  );
  const local = useLocalPlaces();
  // las geocercas de StreamHub (solo lectura) y los lugares de prueba que se
  // crean aquí, guardados en el navegador
  const todosLugares = useMemo(
    () => fusionarPorId(propios ?? [], local.lugares, (l) => l.place_id),
    [propios, local.lugares]
  );
  const todosTrayectos = useMemo(
    () => fusionarPorId(trayectos ?? [], local.trayectos, (t) => t.trayecto_id),
    [trayectos, local.trayectos]
  );
  const refrescarTodo = () => {
    void refP();
    void refT();
    void refQ();
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
      true
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
    todosLugares,
    idsOcultosMapa,
    importando,
    idsConflictoImp,
    coloresImport,
  ]);
  const fcGlobales = useMemo(
    () => fcLugares(importando ? [] : (globales ?? []), false),
    [globales, importando]
  );
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
      ...itemsDesdeFC(fcPropios, todosLugares),
      ...itemsDesdeFC(fcTray),
    ].map((i) => ({ ...i, abajo: true }));
    return [...itemsDesdeFC(fcImport), ...guardados];
  }, [importando, fcImport, fcPropios, fcTray, todosLugares]);

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
      color: colorDeFormLugar(form, cats ?? []),
      name: form.name.trim() || "Nuevo lugar",
      place_id: padreId,
      parent_id: null,
      icon: form.icon,
    });
    const interiores = form.inners.map((inner) =>
      featurePrevia(inner, {
        inner: true,
        color: colorInner(inner),
        name: inner.name.trim() || "Interior",
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
    modo,
    form.geom,
    form.lat,
    form.lon,
    form.radius_m,
    form.vertices,
    form.cerrado,
    form.color,
    form.category_id,
    form.name,
    form.icon,
    form.place_id,
    form.inners,
    cats,
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

  /** Lugar del badge si es propio (los globales de carrier son de solo lectura). */
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
      setMsg("La geocerca interior debe quedar dentro del lugar.");
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
    if (mensajePadreIncompleto(form)) return;
    setMsg(null);
    setPasoLugar("interiores");
  };

  const volverAGeocerca = () => {
    setMsg(null);
    setForm((f) => ({ ...f, innerEditId: null }));
    setPasoLugar("geocerca");
  };

  useEffect(() => {
    if (enabled) return;
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
  }, [enabled]);
  // Abrir, cerrar o guardar un formulario desmonta la lista bajo el mouse (su
  // mouseleave no llega): la geocerca que estaba resaltada deja de estarlo.
  useEffect(() => setHoveredPlaceId(null), [modo]);
  // Borrador: lo abierto se guarda con cada cambio, así al recargar se sigue
  // ahí. Cerrar o guardar (volver a "ver" desde un formulario) lo borra.
  const modoAntes = useRef(modo);
  useEffect(() => {
    if (modo === "lugar") {
      guardarBorrador(ambito, {
        tipo: "lugar",
        form,
        paso: pasoLugar,
        original: formOriginal.current,
        inicial: inicialLugar.current,
      });
    } else if (modo === "trayecto") {
      guardarBorrador(ambito, {
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
      borrarBorrador(ambito);
    }
    modoAntes.current = modo;
  }, [ambito, modo, form, pasoLugar, tray, pasoTrayecto, trayPathAjustado]);

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
    const b = leerBorrador(ambito);
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
      setTray(b.tray);
      setTrayPathAjustado(b.pathAjustado);
      setPuntoMapaId(null);
      setPasoTrayecto(b.paso);
      setModo("trayecto");
    }
    // la forma a la vista (el mapa recién cargado está en su vista inicial)
    cuandoHayaMapa(() => encuadrarBorrador(b));
    const nombre = (b.tipo === "lugar" ? b.form.name : b.tray.name).trim();
    const que = b.tipo === "lugar" ? "del lugar" : "del trayecto";
    toast.info(
      nombre
        ? `Se recuperó la edición de «${nombre}» sin guardar.`
        : `Se recuperó la edición ${que} sin guardar.`,
      { action: { label: "Descartar", onClick: cerrarForm } }
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
  const irALugar = (l: Lugar) => {
    const p = anclaLugar(l);
    if (p)
      mapRef.current?.flyTo({
        center: [p[1], p[0]],
        zoom: 13,
        duration: 400,
      });
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
      address: destino.address ?? "",
      external_id: destino.external_id ?? "",
      radius_m: destino.radius_m ?? 250,
      lat: destino.center?.[0] ?? null,
      lon: destino.center?.[1] ?? null,
      geom: esPoligono(destino) ? "polygon" : "circle",
      cerrado: esPoligono(destino),
      vertices: esPoligono(destino) ? (destino.polygon ?? []) : [],
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

  const guardarLugar = async () => {
    // algo mal (forma, medidas, vigencia, interiores): no se guarda
    const error = errorLugar(form);
    if (error) {
      setMsg(error);
      return;
    }
    const orig = formOriginal.current;
    if (
      orig &&
      pedirVersion("lugar", form.place_id, form.name, cambiosLugar(orig, form))
    )
      return;
    await persistirLugar(null);
  };

  /**
   * Editado con cambios: antes de guardar, el diálogo de versión. Devuelve si
   * lo abrió (el guardado sigue desde confirmarVersion).
   */
  const pedirVersion = (
    tipo: TipoVersionado,
    id: string | null,
    nombre: string,
    cambios: CambioVersion[]
  ): boolean => {
    if (!id || cambios.length === 0) return false;
    setVersionPendiente({
      tipo,
      id,
      nombre,
      que: tipo === "lugar" ? "la geocerca" : "el trayecto",
      actual: versiones.versionDe(tipo, id) ?? "",
      cambios,
    });
    return true;
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

  const anotarVersion = (v: NuevaVersion | null) => {
    if (!v) return;
    versiones.registrar(v.tipo, v.id, {
      version: nextVersion(v.actual, v.bump),
      bump: v.bump,
      descripcion: v.descripcion,
      cambios: v.cambios.map((c) => c.texto),
    });
  };

  const persistirLugar = async (version: NuevaVersion | null) => {
    const innersOk = innersParaGuardar(form.inners);
    // de prueba en el navegador: PT4 ya no se lee y StreamHub no se escribe
    if (LUGARES_EN_LOCAL || isLocalId(form.place_id)) {
      guardarLugarLocal(
        form.place_id ?? newLocalId(),
        form.place_id
          ? "Lugar de prueba actualizado."
          : "Lugar de prueba guardado en este navegador.",
        version
      );
      return;
    }
    setGuardando(true);
    setMsg(null);
    const metadata = metadataParaGuardar(form);
    const base = {
      p_name: form.name,
      p_geometry_type: form.geom,
      p_category_id: form.category_id ? Number(form.category_id) : null,
      p_address: form.address || null,
      p_lat: form.lat,
      p_lon: form.lon,
      p_radius_m: form.radius_m,
      p_vertices: form.geom === "polygon" ? form.vertices : null,
      p_metadata: metadata,
      p_external_id: form.external_id || null,
      p_actor: "app-settings",
    };
    const res = form.place_id
      ? await tryPost("fn_pt4_update_place", {
          p_place_id: form.place_id,
          ...base,
        })
      : await tryPost("fn_pt4_create_place", base);
    if (res === null) {
      setGuardando(false);
      guardarLugarLocal(form.place_id ?? newLocalId(), MSG_LOCAL, version);
      return;
    }
    if (res?.ok === false) {
      setGuardando(false);
      toast.error(`No guardado — ${res?.detalle ?? res?.error}`);
      return;
    }
    const pid = form.place_id ?? res?.place_id;
    if (pid && (form.active_from || form.active_until)) {
      await post("fn_pt4_set_validity", {
        p_place_id: pid,
        p_active_from: form.active_from || null,
        p_active_until: form.active_until || null,
        p_actor: "app-settings",
      });
    }
    if (pid) await persistirHijosServidor(pid, innersOk);
    anotarVersion(version);
    setGuardando(false);
    setMsg(null);
    toast.success(
      form.place_id
        ? "Lugar actualizado."
        : "Lugar creado y proyectado a geocercas."
    );
    setForm({ ...FORM_VACIO });
    setPasoLugar("geocerca");
    setModo("ver");
    refrescarTodo();
  };

  const persistirHijosLocal = (parent: ReturnType<typeof lugarDesdeForm>) => {
    const innersOk = innersParaGuardar(form.inners);
    const keep = new Set(innersOk.map((i) => i.id));
    for (const id of idsHijosDe(parent.place_id, todosLugares)) {
      if (!keep.has(id)) local.deleteLugar(id);
    }
    for (const inner of innersOk) {
      local.saveLugar(lugarHijoDesdeInner(inner, parent));
    }
  };

  const persistirHijosServidor = async (
    parentId: string,
    innersOk: ReturnType<typeof innersParaGuardar>
  ) => {
    const keep = new Set(innersOk.map((i) => i.id));
    const quitadas = idsHijosDe(parentId, todosLugares).filter(
      (id) => !keep.has(id)
    );
    await enSerie(quitadas, async (id) => {
      await tryPost("fn_pt4_delete_place", {
        p_place_id: id,
        p_actor: "app-settings",
      });
      local.deleteLugar(id);
    });
    await enSerie(innersOk, (inner) => {
      const body = payloadInner(inner, parentId, form);
      return isLocalId(inner.id)
        ? tryPost("fn_pt4_create_place", body)
        : tryPost("fn_pt4_update_place", { p_place_id: inner.id, ...body });
    });
  };

  const guardarLugarLocal = (
    placeId: string,
    okMsg: string,
    version: NuevaVersion | null = null
  ) => {
    const parent = lugarDesdeForm(form, cats ?? [], placeId);
    const ok = local.saveLugar(parent);
    setMsg(null);
    avisarGuardado(ok, okMsg);
    if (!ok) return;
    anotarVersion(version);
    persistirHijosLocal(parent);
    setForm({ ...FORM_VACIO });
    setPasoLugar("geocerca");
    setModo("ver");
  };

  const borrarLugar = (l: Lugar) => {
    if (!puedeEditar || esDeStreamhub(l.place_id)) return;
    confirmar("Eliminar lugar", l.name, () => void eliminarLugar(l));
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
      if (!silencioso) toast.success("Lugar local eliminado.");
      return true;
    }
    await enSerie(
      hijos.filter((id) => !isLocalId(id)),
      (id) =>
        tryPost("fn_pt4_delete_place", {
          p_place_id: id,
          p_actor: "app-settings",
        })
    );
    const res = await tryPost("fn_pt4_delete_place", {
      p_place_id: l.place_id,
      p_actor: "app-settings",
    });
    setMsg(null);
    if (silencioso) return borradoOk(res);
    avisarBorrado(res, "Lugar", habiaCopiaLocal);
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
  }, []);

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

  // Las respuestas de Directions pueden llegar fuera de orden: solo vale la
  // de la última petición.
  const rutaSeq = useRef(0);

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
      setMsg("No se encontró ruta por calles; queda la línea recta.");
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
   * información; sin nombre, se queda ahí (el formulario marca el campo).
   */
  const guardarOContinuarTrayecto = () => {
    if (!puntosRecorrido(tray)) {
      cambiarPasoTrayecto("recorrido");
      setMsg("Ubica al menos el origen (A) y el destino (B).");
      return;
    }
    if (pasoTrayecto === "recorrido") {
      cambiarPasoTrayecto("datos");
      return;
    }
    if (!tray.name.trim()) {
      setMsg("Falta el nombre del trayecto.");
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
    const error = errorTrayecto(tray);
    if (error) {
      setMsg(error);
      return;
    }
    const orig = trayOriginal.current;
    if (
      orig &&
      pedirVersion("trayecto", tray.id, tray.name, cambiosTrayecto(orig, tray))
    )
      return;
    await persistirTrayecto(null);
  };

  const persistirTrayecto = async (version: NuevaVersion | null) => {
    if (isLocalId(tray.id)) {
      guardarTrayectoLocal(tray.id!, "Trayecto local actualizado.", version);
      return;
    }
    setGuardando(true);
    const res = await tryPost("fn_pt4_save_trayecto", {
      p_name: tray.name,
      p_kind: tray.kind,
      p_width_m: tray.width_m,
      p_trayecto_id: tray.id,
      p_external_id: tray.external_id || null,
      p_points: tray.ajustado && trayPathAjustado ? trayPathAjustado : tray.pts,
      p_waypoints: tray.pts,
      p_ajustado: tray.ajustado,
      p_actor: "app-settings",
    });
    setGuardando(false);
    if (res === null) {
      guardarTrayectoLocal(tray.id ?? newLocalId(), MSG_LOCAL, version);
      return;
    }
    if (res?.ok === false) {
      toast.error(`No guardado — ${res?.detalle ?? res?.error}`);
      return;
    }
    anotarVersion(version);
    setMsg(null);
    toast.success(tray.id ? "Trayecto actualizado." : "Trayecto guardado.");
    setTray({ ...TRAY_VACIO });
    setTrayPathAjustado(null);
    setModo("ver");
    refrescarTodo();
  };

  const guardarTrayectoLocal = (
    trayectoId: string,
    okMsg: string,
    version: NuevaVersion | null = null
  ) => {
    const ok = local.saveTrayecto(
      trayectoDesdeForm(tray, trayPathAjustado, trayectoId)
    );
    setMsg(null);
    avisarGuardado(ok, okMsg);
    if (!ok) return;
    anotarVersion(version);
    setTray({ ...TRAY_VACIO });
    setTrayPathAjustado(null);
    setModo("ver");
  };

  const borrarTrayecto = (t: Trayecto) => {
    if (!puedeEditar) return;
    confirmar("Eliminar trayecto", t.name, () => void eliminarTrayecto(t));
  };

  const eliminarTrayecto = async (t: Trayecto, silencioso = false) => {
    if (modo === "trayecto" && tray.id === t.trayecto_id) cerrarForm();
    const habiaCopiaLocal = local.trayectos.some(
      (x) => x.trayecto_id === t.trayecto_id
    );
    local.deleteTrayecto(t.trayecto_id);
    if (isLocalId(t.trayecto_id)) {
      setMsg(null);
      if (!silencioso) toast.success("Trayecto local eliminado.");
      return true;
    }
    const res = await tryPost("fn_pt4_delete_trayecto", {
      p_trayecto_id: t.trayecto_id,
      p_actor: "app-settings",
    });
    setMsg(null);
    if (silencioso) return borradoOk(res);
    avisarBorrado(res, "Trayecto", habiaCopiaLocal);
    refrescarTodo();
    return borradoOk(res);
  };

  /**
   * Borrar varios elegidos en la lista, con una sola confirmación y un solo
   * aviso. Los interiores cuyo lugar también se borra no van aparte: se
   * borran con él.
   */
  const borrarSeleccion = (
    lugaresSel: Lugar[],
    trayectosSel: Trayecto[],
    alTerminar?: () => void
  ) => {
    if (!puedeEditar) return;
    // las de StreamHub no se eliminan desde aquí: quedan fuera de la selección
    const editables = lugaresSel.filter((l) => !esDeStreamhub(l.place_id));
    if (editables.length < lugaresSel.length) {
      toast.info("Las geocercas de StreamHub no se eliminan desde aquí.");
    }
    const ids = new Set(editables.map((l) => l.place_id));
    const sueltos = editables.filter((l) => {
      const padre = parentPlaceId(l);
      return !padre || !ids.has(padre);
    });
    const total = sueltos.length + trayectosSel.length;
    if (total === 0) return;
    confirmar(
      `Eliminar ${total} elemento${total === 1 ? "" : "s"}`,
      resumenSeleccion(sueltos.length, trayectosSel.length),
      () =>
        void (async () => {
          const okLugares = await enSerie(sueltos, (l) =>
            eliminarLugar(l, true)
          );
          const okTrayectos = await enSerie(trayectosSel, (t) =>
            eliminarTrayecto(t, true)
          );
          const fallidos = [...okLugares, ...okTrayectos].filter(
            (ok) => !ok
          ).length;
          refrescarTodo();
          alTerminar?.();
          avisarBorradoLote(total, fallidos);
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
        ...(await parsearArchivoLugares(file)),
      }));
    } catch {
      setMsg("No se pudo leer el archivo.");
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
      if (vacio) setMsg(MSG_IMPORT_VACIO);
      return;
    }
    setImp((s) => {
      const keep = (s.lotes ?? []).filter(
        (l) => !nuevos.some((n) => n.filename === l.filename)
      );
      return { ...s, lotes: [...keep, ...nuevos], resultado: null };
    });
  };

  const guardarFilaLocal = (fila: FilaImport) => {
    const catId = imp.catDef ? Number(imp.catDef) : null;
    const lugar = lugarDesdeFilaImport(
      fila,
      cats ?? [],
      newLocalId(),
      Number.isFinite(catId) ? catId : null
    );
    return local.saveLugar(lugar);
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
  });

  /** Guarda un trayecto importado; sin servidor queda en el respaldo local. */
  const guardarTrayectoImport = async (
    fila: FilaImport,
    trayectoId: string | null
  ): Promise<"servidor" | "local" | "rechazada"> => {
    const t = trayectoDeFila(fila, trayectoId ?? newLocalId());
    if (trayectoId && isLocalId(trayectoId)) {
      return local.saveTrayecto(t) ? "local" : "rechazada";
    }
    const res = await tryPost("fn_pt4_save_trayecto", {
      p_name: t.name,
      p_kind: t.kind,
      p_width_m: t.width_m,
      p_trayecto_id: trayectoId,
      p_external_id: t.external_id,
      p_points: t.points,
      p_waypoints: t.waypoints ?? t.points,
      p_ajustado: t.ajustado,
      p_actor: "app-settings",
    });
    if (res === null) return local.saveTrayecto(t) ? "local" : "rechazada";
    return res?.ok === false ? "rechazada" : "servidor";
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
    fila: FilaImport
  ): Promise<boolean> => {
    if (esDeStreamhub(l.place_id)) return false;
    const poly = filaEsPoligono(fila);
    const radio = poly
      ? null
      : (fila.radius_m ?? l.radius_m ?? FORM_VACIO.radius_m);
    const nuevo: Lugar = {
      ...l,
      name: fila.name,
      address: fila.address ?? l.address,
      external_id: fila.external_id || l.external_id,
      geometry_type: poly ? "polygon" : "circle",
      center: [fila.lat, fila.lon],
      polygon: poly ? (fila.vertices ?? []) : null,
      radius_m: radio,
    };
    if (isLocalId(l.place_id)) return local.saveLugar(nuevo);
    const res = await tryPost("fn_pt4_update_place", {
      p_place_id: l.place_id,
      p_name: nuevo.name,
      p_geometry_type: nuevo.geometry_type,
      p_category_id: l.category_id,
      p_address: nuevo.address || null,
      p_lat: fila.lat,
      p_lon: fila.lon,
      p_radius_m: radio,
      p_vertices: nuevo.polygon,
      p_metadata: l.metadata,
      p_external_id: nuevo.external_id || null,
      p_actor: "app-settings",
    });
    if (res === null) return local.saveLugar(nuevo);
    return res?.ok !== false;
  };

  /** Otro lugar guardado que la fila nueva reemplaza (con sus interiores). */
  const quitarReemplazado = async (l: Lugar): Promise<boolean> => {
    if (esDeStreamhub(l.place_id)) return false;
    const ids = [...idsHijosDe(l.place_id, todosLugares), l.place_id];
    for (const id of ids) local.deleteLugar(id);
    const resultados = await enSerie(
      ids.filter((id) => !isLocalId(id)),
      (id) =>
        tryPost("fn_pt4_delete_place", {
          p_place_id: id,
          p_actor: "app-settings",
        })
    );
    return resultados.every(borradoOk);
  };

  /** Una fila guardada sola: en el servidor, local si no responde, o rechazada. */
  const destinoDeFila = (
    res: { ok?: boolean } | null,
    fila: FilaImport
  ): DestinoImport => {
    if (res === null) return guardarFilaLocal(fila) ? "local" : "rechazada";
    return res?.ok === false ? "rechazada" : "servidor";
  };

  /** Puntos (círculos) en una sola llamada; sin servidor, uno a uno en local. */
  const importarPuntos = async (
    puntos: FilaImport[],
    lotes: LoteImport[]
  ): Promise<ConteoImport> => {
    if (puntos.length === 0) return CONTEO_VACIO;
    if (LUGARES_EN_LOCAL)
      return contarDestinos(puntos.map((f) => destinoDeFila(null, f)));
    const formatos = [...new Set(lotes.map((l) => l.formato))];
    const res = await tryPost("fn_pt4_import_places", {
      p_filename: lotes.map((l) => l.filename).join(", "),
      p_format: formatos.length === 1 ? (formatos[0] ?? "mixto") : "mixto",
      p_rows: puntos,
      p_defaults: {
        radius_m: FORM_VACIO.radius_m,
        category_id: imp.catDef ? Number(imp.catDef) : null,
      },
      p_actor: "app-settings",
    });
    if (res === null)
      return contarDestinos(puntos.map((f) => destinoDeFila(null, f)));
    if (res?.ok === false)
      return { ...CONTEO_VACIO, rechazadas: puntos.length };
    return {
      ...CONTEO_VACIO,
      creadas: Number(res?.creadas ?? puntos.length),
      rechazadas: Number(res?.rechazadas ?? 0),
    };
  };

  const crearPoligonoImport = async (
    fila: FilaImport
  ): Promise<DestinoImport> => {
    if (LUGARES_EN_LOCAL) return destinoDeFila(null, fila);
    const catId = imp.catDef ? Number(imp.catDef) : null;
    const res = await tryPost("fn_pt4_create_place", {
      p_name: fila.name,
      p_geometry_type: "polygon",
      p_category_id: Number.isFinite(catId) ? catId : null,
      p_address: fila.address || null,
      p_lat: fila.lat,
      p_lon: fila.lon,
      p_radius_m: null,
      p_vertices: fila.vertices,
      p_metadata: null,
      p_external_id: fila.external_id || null,
      p_actor: "app-settings",
    });
    return destinoDeFila(res, fila);
  };

  const confirmarImport = async () => {
    setGuardando(true);
    const lotes = imp.lotes ?? [];
    const plan = planImport(filasImp, conflictosImp, imp.decisiones);
    const filas = plan.crear.map(sinUid);
    const lineas = filas.filter(filaEsLinea);
    const geocercas = filas.filter((f) => !filaEsLinea(f));
    // en este orden, una cosa a la vez: puntos, polígonos, trayectos nuevos,
    // trayectos y lugares que se actualizan y, al final, los reemplazados
    const deLosPuntos = await importarPuntos(
      geocercas.filter((f) => !filaEsPoligono(f)),
      lotes
    );
    const nuevos = contarDestinos([
      ...(await enSerie(geocercas.filter(filaEsPoligono), crearPoligonoImport)),
      ...(await enSerie(lineas, (f) => guardarTrayectoImport(f, null))),
    ]);
    const traysActualizados = await enSerie(
      plan.actualizarTrayectos,
      ({ trayecto, fila }) =>
        guardarTrayectoImport(sinUid(fila), trayecto.trayecto_id)
    );
    const lugaresActualizados = await enSerie(
      plan.actualizar,
      ({ lugar, fila }) => reemplazarConFila(lugar, fila)
    );
    const reemplazos = await enSerie(plan.borrar, quitarReemplazado);

    const cuenta = (xs: boolean[]) => xs.filter(Boolean).length;
    const trayOk = traysActualizados.map((r) => r !== "rechazada");
    setGuardando(false);
    setHoverImportUid(null);
    setImp((s) => ({
      ...s,
      resultado: textoResultadoImport({
        creadas: deLosPuntos.creadas + nuevos.creadas,
        actualizadas: cuenta(trayOk) + cuenta(lugaresActualizados),
        reemplazadas: cuenta(reemplazos),
        locales: deLosPuntos.locales + nuevos.locales,
        rechazadas:
          deLosPuntos.rechazadas +
          nuevos.rechazadas +
          (trayOk.length - cuenta(trayOk)) +
          (lugaresActualizados.length - cuenta(lugaresActualizados)),
      }),
      lotes: [],
      decisiones: {},
      seleccion: [],
    }));
    refrescarTodo();
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
      setImp((s) => ({
        ...IMP_VACIO,
        catDef: s.catDef ?? IMP_VACIO.catDef,
      }));
      setModo("import");
    }
    setMsg(null);
  };

  return {
    MAPBOX_TOKEN,
    carrierMode,
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
    globales,
    trayectos,
    cats,
    cuotas,
    local,
    todosLugares,
    todosTrayectos,
    lugares,
    editandoLugarId,
    editandoTrayId,
    fcPropios,
    fcGlobales,
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
    versionDe: versiones.versionDe,
    historialDe: versiones.historialDe,
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

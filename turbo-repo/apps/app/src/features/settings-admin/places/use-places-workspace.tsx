"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import type { MapRef, MapLayerMouseEvent } from "react-map-gl";
import type { Feature, FeatureCollection, Polygon, LineString } from "geojson";
import type { LayersList } from "@deck.gl/core";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";
import { anclaLugar } from "./place-labels";
import { radioLugarM } from "./geofence-lod";
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
} from "./polygon-draw";
import { direccionDesdePunto } from "./geocoding";
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
} from "./recorrido";
import {
  COLOR_KEY,
  FORM_VACIO,
  TRAY_VACIO,
  type Categoria,
  type FormLugar,
  type FormTrayecto,
  type LatLon,
  type PasoLugar,
  type PasoTrayecto,
  type Lugar,
  type Trayecto,
  colorDeFormLugar,
  colorDeLugar,
  iconoDeLugar,
  metadataAFilas,
  metadataParaGuardar,
} from "./places.types";
import {
  actualizarInner,
  colorInner,
  idsHijosDe,
  innerComoForm,
  innerEnEdicion,
  innersDelLugar,
  innersParaGuardar,
  lugarHijoDesdeInner,
  mensajeInnerIncompleto,
  mensajePadreIncompleto,
  parentPlaceId,
  payloadInner,
  puntoDentroDelPadre,
} from "./inner-geofences";
import {
  fusionarPorId,
  isLocalId,
  lugarDesdeForm,
  newLocalId,
  trayectoDesdeForm,
  useLocalPlaces,
} from "./local-store";
import {
  aplicarRectangulo,
  esPoligonoLibre,
  mapaAgregaPunto,
} from "./geofence-editor";
import { filtrarLugares } from "./catalog-search";
import { ubicarPuntoEnMapa } from "./places-map-camera";
import {
  filaEsPoligono,
  filasDeLotes,
  lugarDesdeFilaImport,
  parsearArchivoLugares,
  type FilaImport,
  type LoteImport,
} from "./import-places";

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
// Tope al crear un círculo: el radio de 20 m cabe entero (nivel edificio).
const MAX_ZOOM_CIRCULO = 22;

// Ancho que ocupa la ventana flotante del formulario (340 px + margen).
const ANCHO_VENTANA_FLOTANTE = 356;

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
const fcLineas = (xs: { pts: [number, number][] }[]): FeatureCollection => ({
  type: "FeatureCollection",
  features: xs
    .filter((x) => x.pts?.length > 1)
    .map((x) => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: x.pts.map(([la, lo]) => [lo, la]),
      } as LineString,
    })),
});

// [lat,lon][] → Mapbox Directions (driving) → [lat,lon][] pegado a calles
async function ajustarACalles(
  pts: [number, number][],
  token: string
): Promise<{ pts: [number, number][]; vias: string[] } | null> {
  if (pts.length < 2 || pts.length > 25) return null;
  const coords = pts.map(([la, lo]) => `${lo},${la}`).join(";");
  const r = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&steps=true&access_token=${token}`
  );
  if (!r.ok) return null;
  const j = await r.json();
  const ruta = j?.routes?.[0];
  if (!ruta?.geometry?.coordinates) return null;
  const vias = new Set<string>();
  for (const leg of ruta.legs ?? [])
    for (const st of leg.steps ?? []) if (st.name) vias.add(st.name);
  // el lab acepta 2..500 puntos: decimar conservando extremos
  const crudos: [number, number][] = ruta.geometry.coordinates.map(
    ([lo, la]: number[]) => [la, lo] as [number, number]
  );
  const MAX = 480;
  const pts2 =
    crudos.length <= MAX
      ? crudos
      : crudos
          .filter((_, i) => i % Math.ceil(crudos.length / MAX) === 0)
          .concat([crudos[crudos.length - 1]]);
  return { pts: pts2, vias: [...vias].slice(0, 12) };
}

const MSG_IMPORT_VACIO =
  "El archivo no tiene filas válidas (CSV, KML o GeoJSON con puntos o polígonos).";

// Mapbox simplifica GeoJSON al alejar el zoom (tolerance 0.375 por defecto):
// círculos chicos y polígonos detallados pierden vértices y dejan de coincidir
// con la geocerca real. 0 = dibujar siempre los vértices exactos.
export const GEOJSON_EXACTO = 0;

export const PLACES_INITIAL_VIEW = {
  longitude: -70.9,
  latitude: -33.3,
  zoom: 6.5,
};
// Everything is drawn with native Source/Layer children; no deck.gl layers.
export const NO_DECK_LAYERS: LayersList = [];

const IMP_VACIO = {
  lotes: [] as LoteImport[],
  catDef: "",
  resultado: null as string | null,
};

export function usePlacesWorkspace(
  mapRef: RefObject<MapRef | null>,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
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
  // import
  const [imp, setImp] = useState({ ...IMP_VACIO });
  const [trayPathAjustado, setTrayPathAjustado] = useState<
    [number, number][] | null
  >(null);
  const [msg, setMsg] = useState<string | null>(null);
  // confirmación de borrado con el modal del sistema (no window.confirm)
  const [confirmacion, setConfirmacion] = useState<{
    titulo: string;
    descripcion: ReactNode;
    accion: () => void;
  } | null>(null);
  const confirmar = (
    titulo: string,
    descripcion: ReactNode,
    accion: () => void
  ) => setConfirmacion({ titulo, descripcion, accion });
  const [guardando, setGuardando] = useState(false);

  const { data: propios, mutate: refP } = useSWR<Lugar[]>(
    enabled ? "/app/api/atc/rpc/fn_pt4_places" : null,
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
  const idsOcultosMapa = useMemo(() => {
    const ids = new Set<string>();
    if (editandoLugarId) {
      ids.add(editandoLugarId);
      for (const id of idsHijosDe(editandoLugarId, todosLugares)) ids.add(id);
    }
    for (const inner of form.inners) ids.add(inner.id);
    return ids;
  }, [editandoLugarId, todosLugares, form.inners]);
  const fcPropios = useMemo(
    () =>
      fcLugares(
        todosLugares.filter((l) => !idsOcultosMapa.has(l.place_id)),
        true
      ),
    [todosLugares, idsOcultosMapa]
  );
  const fcGlobales = useMemo(
    () => fcLugares(globales ?? [], false),
    [globales]
  );
  const fcTray = useMemo(
    () =>
      fcLineas(
        todosTrayectos
          .filter((t) => t.trayecto_id !== editandoTrayId)
          .map((t) => ({ pts: t.points }))
      ),
    [todosTrayectos, editandoTrayId]
  );

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
    const colorPadre = colorDeFormLugar(form, cats ?? []);
    const features: Feature[] = [];
    if (form.geom === "circle" && form.lat != null) {
      features.push({
        type: "Feature",
        properties: {
          inner: false,
          color: colorPadre,
          fill: true,
          name: form.name.trim() || "Nuevo lugar",
          place_id: form.place_id || "preview-padre",
          parent_id: null,
          radius_m: form.radius_m,
          icon: form.icon,
        },
        geometry: {
          type: "Polygon",
          coordinates: [circuloPoly(form.lat, form.lon!, form.radius_m)],
        } as Polygon,
      });
    } else if (form.geom === "polygon") {
      const geom = geometriaDibujo(form.vertices, form.cerrado);
      if (geom) {
        features.push({
          type: "Feature",
          properties: {
            inner: false,
            color: colorPadre,
            fill: form.cerrado,
            name: form.name.trim() || "Nuevo lugar",
            place_id: form.place_id || "preview-padre",
            parent_id: null,
            radius_m: radioLugarM({
              polygon: form.vertices,
              center:
                form.lat != null && form.lon != null
                  ? [form.lat, form.lon]
                  : null,
              radius_m: form.radius_m,
            }),
            icon: form.icon,
          },
          geometry: geom,
        });
      }
    }
    for (const inner of form.inners) {
      if (inner.geom === "circle" && inner.lat != null && inner.lon != null) {
        features.push({
          type: "Feature",
          properties: {
            inner: true,
            color: colorInner(inner),
            fill: true,
            name: inner.name.trim() || "Interior",
            place_id: inner.id,
            parent_id: form.place_id || "preview-padre",
            radius_m: inner.radius_m,
            icon: "",
          },
          geometry: {
            type: "Polygon",
            coordinates: [circuloPoly(inner.lat, inner.lon, inner.radius_m)],
          } as Polygon,
        });
      } else if (inner.geom === "polygon") {
        const geom = geometriaDibujo(inner.vertices, inner.cerrado);
        if (geom) {
          features.push({
            type: "Feature",
            properties: {
              inner: true,
              color: colorInner(inner),
              fill: inner.cerrado,
              name: inner.name.trim() || "Interior",
              place_id: inner.id,
              parent_id: form.place_id || "preview-padre",
              radius_m: radioLugarM({
                polygon: inner.vertices,
                center:
                  inner.lat != null && inner.lon != null
                    ? [inner.lat, inner.lon]
                    : null,
                radius_m: inner.radius_m,
              }),
              icon: "",
            },
            geometry: geom,
          });
        }
      }
    }
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
  const prevTrayAdjFC = useMemo(
    () =>
      modo === "trayecto" && tray.ajustado && trayPathAjustado
        ? linea(trayPathAjustado)
        : FC_VACIA,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modo, tray.ajustado, trayPathAjustado]
  );

  // Clic derecho en modo ver: menú para crear un lugar o trayecto en ese punto.
  const onMapContextMenu = (e: MapLayerMouseEvent) => {
    e.originalEvent.preventDefault(); // sin el menú del navegador
    if (modo !== "ver") return;
    setMenu({
      x: e.point.x,
      y: e.point.y,
      lat: e.lngLat.lat,
      lon: e.lngLat.lng,
    });
  };

  const onMapClick = (e: MapLayerMouseEvent) => {
    const la = e.lngLat.lat,
      lo = e.lngLat.lng;
    if (modo === "ver") {
      // el menú "crear aquí" se abre con clic derecho; un clic normal lo cierra
      setMenu(null);
      return;
    }
    if (modo === "lugar") {
      if (pasoLugar === "interiores") {
        const inner = innerEnEdicion(form);
        if (!inner) return;
        if (!puntoDentroDelPadre(form, [la, lo])) {
          setMsg("La geocerca interior debe quedar dentro del lugar.");
          return;
        }
        setMsg(null);
        if (inner.geom === "circle") {
          setForm((f) =>
            actualizarInner(f, inner.id, (g) =>
              g.lat == null ? { ...g, lat: la, lon: lo } : g
            )
          );
        } else if (!esPoligonoLibre(inner)) {
          setForm((f) =>
            actualizarInner(f, inner.id, (g) =>
              g.lat == null ? aplicarRectangulo({ ...g, lat: la, lon: lo }) : g
            )
          );
        } else {
          setForm((f) =>
            actualizarInner(f, inner.id, (g) => agregarVertice(g, [la, lo]))
          );
        }
        return;
      }
      // círculo ya ubicado: se mueve arrastrando su centro, no con clic
      if (form.geom === "circle") {
        if (form.lat == null) {
          setForm((f) => ({ ...f, lat: la, lon: lo }));
          encuadrarCirculo(la, lo, form.radius_m);
        }
      } else if (!esPoligonoLibre(form))
        setForm((f) =>
          f.lat == null ? aplicarRectangulo({ ...f, lat: la, lon: lo }) : f
        );
      else setForm((f) => agregarVertice(f, [la, lo]));
    }
    // punto elegido en la lista o, mientras se dibuja, el siguiente vacío
    const idPunto =
      modo === "trayecto" && pasoTrayecto === "recorrido"
        ? (puntoMapaId ?? primerPuntoVacio(tray))
        : null;
    if (idPunto) ubicarPuntoEnRecorrido(idPunto, [la, lo]);
  };

  // Acerca el mapa al círculo nuevo para dibujar con precisión: el radio
  // ocupa buena parte de la vista, dejando libre el lado de la ventana flotante.
  const encuadrarCirculo = (lat: number, lon: number, radioM: number) => {
    const map = mapRef.current;
    if (!map) return;
    const margen = 80;
    map.fitBounds(cajaCirculo(lat, lon, radioM), {
      padding: {
        top: margen,
        bottom: margen,
        left: margen,
        right: ANCHO_VENTANA_FLOTANTE + margen,
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
        if (
          !actual?.punto ||
          actual.punto[0] !== punto[0] ||
          actual.punto[1] !== punto[1]
        )
          return t;
        return rotularPunto(t, id, nom);
      });
    });
  };

  const crearLugarAqui = () => {
    if (!menu) return;
    encuadrarCirculo(menu.lat, menu.lon, FORM_VACIO.radius_m);
    setForm({ ...FORM_VACIO, lat: menu.lat, lon: menu.lon });
    setPasoLugar("geocerca");
    setMsg(null);
    setModo("lugar");
    setMenu(null);
  };
  const crearTrayectoAqui = () => {
    if (!menu) return;
    const punto: LatLon = [menu.lat, menu.lon];
    setTray({
      ...TRAY_VACIO,
      recorrido: recorridoDesdePts([punto]),
    });
    setTrayPathAjustado(null);
    setPuntoMapaId("destino");
    setPasoTrayecto("recorrido");
    setMsg(null);
    setModo("trayecto");
    setMenu(null);
    rotularPuntoSiSigue("origen", punto);
  };
  const cerrarMenu = useCallback(() => setMenu(null), []);
  // cuando un clic en el mapa agrega algo, el cursor es "+"
  const innerActivo =
    pasoLugar === "interiores" ? innerEnEdicion(form) : undefined;
  const clicAgrega =
    (modo === "trayecto" &&
      pasoTrayecto === "recorrido" &&
      (!!puntoMapaId || !!primerPuntoVacio(tray))) ||
    (modo === "lugar" &&
      (pasoLugar === "interiores"
        ? innerActivo
          ? mapaAgregaPunto(innerComoForm(innerActivo))
          : false
        : mapaAgregaPunto(form)));
  const terminarPoligono = useCallback(() => setForm(terminar), []);
  const deshacerPunto = useCallback(() => setForm(deshacer), []);
  const rehacerPunto = useCallback(() => setForm(rehacer), []);
  const seguirPoligono = useCallback(() => setForm(seguirDibujando), []);
  const cancelarPoligono = useCallback(() => setForm(cancelarDibujo), []);
  const cerrarForm = () => {
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
    setModo("ver");
  }, [enabled]);
  // Al abrir algo para editar: centrarlo sin tocar el zoom. El centro es el
  // del área libre a la izquierda de la ventana flotante, no el del mapa.
  const centrarEnVista = (p: [number, number] | null) => {
    if (!p) return;
    mapRef.current?.easeTo({
      center: [p[1], p[0]],
      offset: [-ANCHO_VENTANA_FLOTANTE / 2, 0],
      duration: 600,
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
  const irATrayecto = (t: Trayecto) => {
    const p = t.points[0];
    if (p) mapRef.current?.flyTo({ center: [p[1], p[0]], zoom: 11 });
  };

  const editarLugar = (l: Lugar) => {
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
    setForm({
      ...FORM_VACIO,
      place_id: destino.place_id,
      name: destino.name,
      category_id:
        destino.category_id != null ? String(destino.category_id) : "",
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
    });
    centrarEnVista(anclaLugar(l));
  };

  const guardarLugar = async () => {
    if (mensajePadreIncompleto(form)) return;
    const innersOk = innersParaGuardar(form.inners);
    for (const inner of innersOk) {
      if (mensajeInnerIncompleto(inner)) return;
    }
    if (isLocalId(form.place_id)) {
      guardarLugarLocal(form.place_id!, "Lugar local actualizado.");
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
      guardarLugarLocal(form.place_id ?? newLocalId(), MSG_LOCAL);
      return;
    }
    if (res?.ok === false) {
      setGuardando(false);
      setMsg(`No guardado — ${res?.detalle ?? res?.error}`);
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
    setGuardando(false);
    setMsg(
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
    for (const id of idsHijosDe(parentId, todosLugares)) {
      if (keep.has(id)) continue;
      await tryPost("fn_pt4_delete_place", {
        p_place_id: id,
        p_actor: "app-settings",
      });
      local.deleteLugar(id);
    }
    for (const inner of innersOk) {
      const body = payloadInner(inner, parentId, form);
      if (isLocalId(inner.id)) {
        await tryPost("fn_pt4_create_place", body);
      } else {
        await tryPost("fn_pt4_update_place", {
          p_place_id: inner.id,
          ...body,
        });
      }
    }
  };

  const guardarLugarLocal = (placeId: string, okMsg: string) => {
    const parent = lugarDesdeForm(form, cats ?? [], placeId);
    const ok = local.saveLugar(parent);
    setMsg(
      ok
        ? okMsg
        : "No se pudo guardar localmente (almacenamiento lleno o bloqueado)."
    );
    if (!ok) return;
    persistirHijosLocal(parent);
    setForm({ ...FORM_VACIO });
    setPasoLugar("geocerca");
    setModo("ver");
  };

  const borrarLugar = (l: Lugar) => {
    const hijos = idsHijosDe(l.place_id, todosLugares).length;
    confirmar(
      "Eliminar lugar",
      <>
        ¿Eliminar <b>{l.name}</b>? Se retira su geocerca
        {hijos > 0 ? ` y ${hijos} interiores` : ""}.
      </>,
      () => void eliminarLugar(l)
    );
  };

  const eliminarLugar = async (l: Lugar) => {
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
      toast.success("Lugar local eliminado.");
      return;
    }
    for (const id of hijos) {
      if (isLocalId(id)) continue;
      await tryPost("fn_pt4_delete_place", {
        p_place_id: id,
        p_actor: "app-settings",
      });
    }
    const res = await tryPost("fn_pt4_delete_place", {
      p_place_id: l.place_id,
      p_actor: "app-settings",
    });
    setMsg(mensajeBorrado(res, "Lugar", habiaCopiaLocal));
    refrescarTodo();
  };

  const editarTrayecto = (t: Trayecto) => {
    setMenu(null);
    setModo("trayecto");
    setMsg(null);
    setPuntoMapaId(null);
    setPasoTrayecto("recorrido");
    const pts = (t.waypoints?.length ? t.waypoints : t.points) ?? [];
    setTray({
      ...TRAY_VACIO,
      id: t.trayecto_id,
      name: t.name,
      icon: t.icon ?? "",
      kind: (t.kind as "vial" | "interno") ?? "vial",
      width_m: t.width_m ?? 30,
      external_id: t.external_id ?? "",
      pts,
      ajustado: !!t.ajustado,
      vias: [],
      recorrido: recorridoDesdePts(pts),
      confirmado: pts.length >= 2,
    });
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
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    const margen = 60;
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      {
        padding: {
          top: margen,
          bottom: margen,
          left: margen,
          right: ANCHO_VENTANA_FLOTANTE + margen,
        },
        maxZoom: MAX_ZOOM_CREAR,
        duration: 800,
      }
    );
  };

  // Las respuestas de Directions pueden llegar fuera de orden: solo vale la
  // de la última petición.
  const rutaSeq = useRef(0);

  // el nombre lo escribe el usuario: trazar no lo completa
  const trazarRuta = async (pts: [number, number][], kind = tray.kind) => {
    const seq = ++rutaSeq.current;
    setTray((t) => ({ ...t, pts, ajustado: false }));
    setTrayPathAjustado(null);
    if (kind !== "vial" || !MAPBOX_TOKEN) {
      encuadrarRuta(pts);
      return;
    }
    setGuardando(true);
    const aj = await ajustarACalles(pts, MAPBOX_TOKEN);
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
   * elegido por dirección; se encuadra el recorrido o, si falta, ese punto.
   */
  const aplicarRecorrido = (
    cambio: (t: FormTrayecto) => FormTrayecto,
    foco?: [number, number]
  ) => {
    const next = cambio(tray);
    if (next === tray) return;
    setTray(next);
    descartarRuta();
    if (!foco) return;
    const pts = puntosRecorrido(next);
    if (pts) encuadrarRuta(pts);
    else centrarEnVista(foco);
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
    if (!tray.confirmado && puntosRecorrido(tray)) {
      setMsg("Confirma el recorrido con «Listo» en la barra del mapa.");
      return;
    }
    if (!tray.name || tray.pts.length < 2) {
      setMsg("Falta nombre o al menos 2 puntos.");
      return;
    }
    if (isLocalId(tray.id)) {
      guardarTrayectoLocal(tray.id!, "Trayecto local actualizado.");
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
      guardarTrayectoLocal(tray.id ?? newLocalId(), MSG_LOCAL);
      return;
    }
    if (res?.ok === false) {
      setMsg(`No guardado — ${res?.detalle ?? res?.error}`);
      return;
    }
    setMsg(tray.id ? "Trayecto actualizado." : "Trayecto guardado.");
    setTray({ ...TRAY_VACIO });
    setTrayPathAjustado(null);
    setModo("ver");
    refrescarTodo();
  };

  const guardarTrayectoLocal = (trayectoId: string, okMsg: string) => {
    const ok = local.saveTrayecto(
      trayectoDesdeForm(tray, trayPathAjustado, trayectoId)
    );
    setMsg(
      ok
        ? okMsg
        : "No se pudo guardar localmente (almacenamiento lleno o bloqueado)."
    );
    if (!ok) return;
    setTray({ ...TRAY_VACIO });
    setTrayPathAjustado(null);
    setModo("ver");
  };

  const borrarTrayecto = (t: Trayecto) =>
    confirmar(
      "Eliminar trayecto",
      <>
        ¿Eliminar el trayecto <b>{t.name}</b>?
      </>,
      () => void eliminarTrayecto(t)
    );

  const eliminarTrayecto = async (t: Trayecto) => {
    if (modo === "trayecto" && tray.id === t.trayecto_id) cerrarForm();
    const habiaCopiaLocal = local.trayectos.some(
      (x) => x.trayecto_id === t.trayecto_id
    );
    local.deleteTrayecto(t.trayecto_id);
    if (isLocalId(t.trayecto_id)) {
      setMsg("Trayecto local eliminado.");
      return;
    }
    const res = await tryPost("fn_pt4_delete_trayecto", {
      p_trayecto_id: t.trayecto_id,
      p_actor: "app-settings",
    });
    setMsg(mensajeBorrado(res, "Trayecto", habiaCopiaLocal));
    refrescarTodo();
  };

  // ── Importación masiva ──
  const onArchivos = async (files: File[]) => {
    const nuevos: LoteImport[] = [];
    let vacio = false;
    for (const file of files) {
      try {
        const { formato, filas } = await parsearArchivoLugares(file);
        if (filas.length) nuevos.push({ filename: file.name, formato, filas });
        else vacio = true;
      } catch {
        setMsg("No se pudo leer el archivo.");
        return;
      }
    }
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

  const confirmarImport = async () => {
    setGuardando(true);
    const lotes = imp.lotes ?? [];
    const filas = filasDeLotes(lotes);
    const puntos = filas.filter((f) => !filaEsPoligono(f));
    const poligonos = filas.filter(filaEsPoligono);
    let creadas = 0;
    let rechazadas = 0;
    let localOk = 0;
    const filename = lotes.map((l) => l.filename).join(", ");
    const formatos = [...new Set(lotes.map((l) => l.formato))];
    const formato = formatos.length === 1 ? (formatos[0] ?? "mixto") : "mixto";

    if (puntos.length > 0) {
      const res = await tryPost("fn_pt4_import_places", {
        p_filename: filename,
        p_format: formato,
        p_rows: puntos,
        p_defaults: {
          radius_m: FORM_VACIO.radius_m,
          category_id: imp.catDef ? Number(imp.catDef) : null,
        },
        p_actor: "app-settings",
      });
      if (res === null) {
        for (const fila of puntos) {
          if (guardarFilaLocal(fila)) localOk += 1;
          else rechazadas += 1;
        }
      } else if (res?.ok === false) {
        rechazadas += puntos.length;
      } else {
        creadas += Number(res?.creadas ?? puntos.length);
        rechazadas += Number(res?.rechazadas ?? 0);
      }
    }

    const catId = imp.catDef ? Number(imp.catDef) : null;
    for (const fila of poligonos) {
      const body = {
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
      };
      const res = await tryPost("fn_pt4_create_place", body);
      if (res === null) {
        if (guardarFilaLocal(fila)) localOk += 1;
        else rechazadas += 1;
      } else if (res?.ok === false) {
        rechazadas += 1;
      } else {
        creadas += 1;
      }
    }

    setGuardando(false);
    const partes = [`Importadas ${creadas}`];
    if (localOk) partes.push(`locales ${localOk}`);
    partes.push(`rechazadas ${rechazadas}`);
    setImp((s) => ({
      ...s,
      resultado: partes.join(" · "),
      lotes: [],
    }));
    refrescarTodo();
  };

  const inp =
    "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white";
  const btnTab = (activo: boolean, color = "bg-blue-600") =>
    `flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
      activo
        ? `${color} text-white`
        : "border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
    }`;

  const abrirImport = () => {
    setMenu(null);
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
    onMapClick,
    clicAgrega,
    crearLugarAqui,
    crearTrayectoAqui,
    cerrarMenu,
    terminarPoligono,
    deshacerPunto,
    rehacerPunto,
    seguirPoligono,
    cancelarPoligono,
    cerrarForm,
    continuarAInteriores,
    volverAGeocerca,
    irALugar,
    irATrayecto,
    editarLugar,
    guardarLugar,
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
    hoverPuntoId,
    setHoverPuntoId,
    deshacerTrayecto,
    rehacerTrayecto,
    editarPuntosTrayecto,
    borrarPuntosTrayecto,
    puntoMapaId,
    elegirPuntoEnMapa,
    guardarTrayecto,
    borrarTrayecto,
    onArchivos,
    confirmarImport,
    fileRef,
    abrirImport,
    inp,
    btnTab,
  };
}

export type PlacesWorkspace = ReturnType<typeof usePlacesWorkspace>;

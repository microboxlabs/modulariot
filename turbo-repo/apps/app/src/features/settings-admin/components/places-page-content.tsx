"use client";

// PT4-b2 · Settings › Lugares de interés — F3 portado del laboratorio,
// COMPLETO contra el mockup validado (feedback Erick 2026-07-23):
// panel a la DERECHA (misma lógica del replay), formulario de lugar con
// geometría circle/polygon + metadata + external_id + vigencia, trayectos
// con ancho/tipo/ajuste a calles (Mapbox Directions), CIRCUITOS (secuencia
// de lugares por referencia, cerrado, ajustado) e IMPORTACIÓN MASIVA
// (csv/kml/kmz). Crear y editar son EL MISMO formulario. Carrier: capa
// global punteada read-only + cuotas 600/9. Tenant SIEMPRE server-side.
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import {
  Source,
  Layer,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Feature, FeatureCollection, Polygon, LineString } from "geojson";
import JSZip from "jszip";
import type { LayersList } from "@deck.gl/core";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";
import MapVisualization, {
  type MapStyleName,
} from "@/features/map-visualization/map-visualization";
import MapStyleSelector from "@/features/geographic-view/components/map-style-selector";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ConfirmModal } from "@/features/dashboard/components/confirm-modal";
import PlaceForm from "../places/place-form";
import PlaceList from "../places/place-list";
import { CircuitoList, TrayectoList } from "../places/route-lists";
import PlaceLabels, {
  PlaceLabelPreview,
  anclaLugar,
} from "../places/place-labels";
import {
  GeofenceHandles,
  RouteEndpoints,
  RoutePointHandles,
} from "../places/geofence-editor";
import { nombreRecorrido, puntosRecorrido } from "../places/recorrido";
import TrayectoForm from "../places/trayecto-form";
import MapCreateMenu from "../places/map-create-menu";
import PolygonDrawToolbar from "../places/polygon-draw-toolbar";
import { CURSOR_AGREGAR } from "../places/cursors";
import {
  agregarVertice,
  anilloGeoJSON,
  cancelarDibujo,
  deshacer,
  puedeDeshacer,
  puedeRehacer,
  puedeTerminar,
  rehacer,
  seguirDibujando,
  terminar,
} from "../places/polygon-draw";
import {
  FORM_VACIO,
  TRAY_VACIO,
  type Categoria,
  type Circuito,
  type FormLugar,
  type FormTrayecto,
  type MetodoTrayecto,
  type Lugar,
  type Trayecto,
  iconoDeLugar,
  metadataAFilas,
  metadataParaGuardar,
} from "../places/places.types";
import {
  fusionarPorId,
  isLocalId,
  lugarDesdeForm,
  newLocalId,
  trayectoDesdeForm,
  useLocalPlaces,
} from "../places/local-store";

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

// Tope del acercamiento al crear un lugar: barrio visible, no nivel edificio.
const MAX_ZOOM_CREAR = 15;

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
        name: l.name,
        color: l.color ?? (propios ? "#1C64F2" : "#6B7280"),
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

// CSV/KML/KMZ → filas {name, lat, lon, radius_m?, address?, external_id?}
async function parsearArchivo(
  file: File
): Promise<{ formato: string; filas: Record<string, unknown>[] }> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const filasKml = (xml: string) => {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return [...doc.querySelectorAll("Placemark")]
      .map((pm) => {
        const coord = pm
          .querySelector("Point coordinates")
          ?.textContent?.trim()
          .split(",");
        return {
          name: pm.querySelector("name")?.textContent?.trim() ?? "Sin nombre",
          address: pm.querySelector("address")?.textContent?.trim() ?? null,
          lon: coord ? Number(coord[0]) : null,
          lat: coord ? Number(coord[1]) : null,
        };
      })
      .filter((r) => r.lat != null && r.lon != null);
  };
  if (ext === "kml")
    return { formato: "kml", filas: filasKml(await file.text()) };
  if (ext === "kmz") {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = Object.values(zip.files).find((f) =>
      f.name.toLowerCase().endsWith(".kml")
    );
    return {
      formato: "kmz",
      filas: entry ? filasKml(await entry.async("text")) : [],
    };
  }
  // CSV: cabecera con name/nombre, lat, lon/lng, radius_m/radio, address/direccion, external_id
  const lineas = (await file.text()).split(/\r?\n/).filter((x) => x.trim());
  const sep = lineas[0]?.includes(";") ? ";" : ",";
  const head = lineas[0].split(sep).map((h) => h.trim().toLowerCase());
  const col = (r: string[], ...names: string[]) => {
    for (const n of names) {
      const i = head.indexOf(n);
      if (i >= 0 && r[i]?.trim()) return r[i].trim();
    }
    return null;
  };
  const filas = lineas
    .slice(1)
    .map((ln) => {
      const r = ln.split(sep);
      return {
        name: col(r, "name", "nombre") ?? "Sin nombre",
        lat: Number(col(r, "lat", "latitud")),
        lon: Number(col(r, "lon", "lng", "longitud")),
        radius_m: col(r, "radius_m", "radio")
          ? Number(col(r, "radius_m", "radio"))
          : undefined,
        address: col(r, "address", "direccion") ?? undefined,
        external_id: col(r, "external_id", "id_externo") ?? undefined,
      };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
  return { formato: "csv", filas };
}

// Mapbox simplifica GeoJSON al alejar el zoom (tolerance 0.375 por defecto):
// círculos chicos y polígonos detallados pierden vértices y dejan de coincidir
// con la geocerca real. 0 = dibujar siempre los vértices exactos.
const GEOJSON_EXACTO = 0;

const PLACES_INITIAL_VIEW = { longitude: -70.9, latitude: -33.3, zoom: 6.5 };
// Everything is drawn with native Source/Layer children; no deck.gl layers.
const NO_DECK_LAYERS: LayersList = [];

export default function PlacesPageContent({ dict }: { dict: I18nRecord }) {
  const runtimeConfig = useRuntimeConfig();
  const MAPBOX_TOKEN = runtimeConfig?.MAPBOX_API_KEY;
  const { carrierMode } = useCarrierMode();
  const mapRef = useRef<MapRef | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleName>("streets");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<
    "ver" | "lugar" | "trayecto" | "circuito" | "import"
  >("ver");
  const [form, setForm] = useState<FormLugar>({ ...FORM_VACIO });
  // trayecto
  const [tray, setTray] = useState({ ...TRAY_VACIO });
  // menú "crear aquí" al hacer clic en el mapa en modo ver
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lon: number;
  } | null>(null);
  // circuito
  const [circ, setCirc] = useState({
    id: null as string | null,
    name: "",
    via_label: "",
    cerrado: false,
    stops: [] as { place_id: string; name: string; stop_kind: string }[],
    path: [] as [number, number][],
    ajustado: false,
    vias: [] as string[],
  });
  // import
  const [imp, setImp] = useState({
    filename: "",
    formato: "",
    filas: [] as Record<string, unknown>[],
    radioDef: 250,
    catDef: "",
    resultado: null as string | null,
  });
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
    "/app/api/atc/rpc/fn_pt4_places",
    fetcher
  );
  const { data: globales } = useSWR<Lugar[]>(
    carrierMode ? "/app/api/atc/rpc/fn_pt4_places_global" : null,
    fetcher
  );
  const { data: trayectos, mutate: refT } = useSWR<Trayecto[]>(
    "/app/api/atc/rpc/fn_pt4_trayectos",
    fetcher
  );
  const { data: circuitos, mutate: refC } = useSWR<Circuito[]>(
    "/app/api/atc/rpc/fn_pt4_circuitos",
    fetcher
  );
  const { data: cats } = useSWR<Categoria[]>(
    "/app/api/atc/rpc/fn_pt4_categorias",
    fetcher
  );
  const { data: cuotas, mutate: refQ } = useSWR<{
    lugares: Cuota;
    trayectos: Cuota;
  }>(carrierMode ? "/app/api/atc/rpc/fn_pt4_quota_status" : null, fetcher);
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
    void refC();
    void refQ();
  };

  const lugares = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const xs = todosLugares;
    return q
      ? xs.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            (l.address ?? "").toLowerCase().includes(q) ||
            (l.external_id ?? "").toLowerCase().includes(q)
        )
      : xs;
  }, [todosLugares, busca]);

  // El lugar/trayecto en edición se dibuja solo como vista previa editable;
  // si también se dibujara el guardado, quedarían dos formas superpuestas.
  const editandoLugarId = modo === "lugar" ? form.place_id : null;
  const editandoTrayId = modo === "trayecto" ? tray.id : null;
  const fcPropios = useMemo(
    () =>
      fcLugares(
        todosLugares.filter((l) => l.place_id !== editandoLugarId),
        true
      ),
    [todosLugares, editandoLugarId]
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
  const fcCirc = useMemo(
    () =>
      fcLineas(
        (circuitos ?? []).map((c) => ({
          pts: (c.path_points ??
            c.stops.map((s) => s.center).filter(Boolean)) as [number, number][],
        }))
      ),
    [circuitos]
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
    if (form.geom === "circle" && form.lat != null)
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [circuloPoly(form.lat, form.lon!, form.radius_m)],
            } as Polygon,
          },
        ],
      };
    if (form.geom === "polygon" && form.vertices.length >= 2)
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [anilloGeoJSON(form.vertices)],
            } as Polygon,
          },
        ],
      };
    return FC_VACIA;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, form.geom, form.lat, form.lon, form.radius_m, form.vertices]);
  const prevTrayRawFC = useMemo(
    () =>
      modo === "trayecto" && !(tray.ajustado && trayPathAjustado)
        ? linea(tray.pts)
        : FC_VACIA,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modo, tray.pts, tray.ajustado, trayPathAjustado]
  );
  const prevTrayAdjFC = useMemo(
    () =>
      modo === "trayecto" && tray.ajustado && trayPathAjustado
        ? linea(trayPathAjustado)
        : FC_VACIA,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modo, tray.ajustado, trayPathAjustado]
  );
  const prevCircFC = useMemo(
    () => (modo === "circuito" ? linea(circ.path) : FC_VACIA),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modo, circ.path]
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
      // círculo ya ubicado: se mueve arrastrando su centro, no con clic
      if (form.geom === "circle")
        setForm((f) => (f.lat == null ? { ...f, lat: la, lon: lo } : f));
      else setForm((f) => agregarVertice(f, [la, lo]));
    }
    if (modo === "trayecto" && tray.metodo === "manual")
      setTray((t) => ({ ...t, pts: [...t.pts, [la, lo]], ajustado: false }));
  };

  // Acerca el mapa al círculo nuevo para dibujar con precisión: el radio
  // ocupa buena parte de la vista, dejando libre el lado de la ventana flotante.
  const encuadrarCirculo = (lat: number, lon: number, radioM: number) => {
    const map = mapRef.current;
    if (!map) return;
    const ancho = map.getContainer().clientWidth;
    const margen = 80;
    map.fitBounds(cajaCirculo(lat, lon, radioM), {
      padding: {
        top: margen,
        bottom: margen,
        left: margen,
        right: Math.min(380, Math.max(margen, ancho * 0.45)),
      },
      maxZoom: MAX_ZOOM_CREAR,
      duration: 800,
    });
  };

  const crearLugarAqui = () => {
    if (!menu) return;
    encuadrarCirculo(menu.lat, menu.lon, FORM_VACIO.radius_m);
    setForm({ ...FORM_VACIO, lat: menu.lat, lon: menu.lon });
    setMsg(null);
    setModo("lugar");
    setMenu(null);
  };
  const crearTrayectoAqui = () => {
    if (!menu) return;
    setTray({ ...TRAY_VACIO, pts: [[menu.lat, menu.lon]] });
    setTrayPathAjustado(null);
    setMsg(null);
    setModo("trayecto");
    setMenu(null);
  };
  const cerrarMenu = useCallback(() => setMenu(null), []);
  // cuando un clic en el mapa agrega algo, el cursor es "+"
  const clicAgrega =
    (modo === "trayecto" && tray.metodo === "manual") ||
    (modo === "lugar" &&
      (form.geom === "polygon" ? !form.cerrado : form.lat == null));
  const terminarPoligono = useCallback(() => setForm(terminar), []);
  const deshacerPunto = useCallback(() => setForm(deshacer), []);
  const rehacerPunto = useCallback(() => setForm(rehacer), []);
  const seguirPoligono = useCallback(() => setForm(seguirDibujando), []);
  const cancelarPoligono = useCallback(() => setForm(cancelarDibujo), []);
  const cerrarForm = () => {
    setForm({ ...FORM_VACIO });
    setTray({ ...TRAY_VACIO });
    setTrayPathAjustado(null);
    setMsg(null);
    setModo("ver");
  };
  const moverPuntoTray = useCallback((i: number, p: [number, number]) => {
    setTray((t) => ({
      ...t,
      pts: t.pts.map((q, j) => (j === i ? p : q)),
      ajustado: false,
    }));
    setTrayPathAjustado(null);
  }, []);
  const deshacerPuntoTray = () => {
    setTray((t) => ({ ...t, pts: t.pts.slice(0, -1), ajustado: false }));
    setTrayPathAjustado(null);
  };

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
    if (p) mapRef.current?.flyTo({ center: [p[1], p[0]], zoom: 13 });
  };

  // Clic en el nombre de un trayecto o circuito: ir a él en el mapa.
  const irATrayecto = (t: Trayecto) => {
    const p = t.points[0];
    if (p) mapRef.current?.flyTo({ center: [p[1], p[0]], zoom: 11 });
  };
  const irACircuito = (c: Circuito) => {
    const p = c.stops[0]?.center;
    if (p) mapRef.current?.flyTo({ center: [p[1], p[0]], zoom: 10 });
  };

  const editarLugar = (l: Lugar) => {
    setMenu(null);
    setModo("lugar");
    setMsg(null);
    setForm({
      place_id: l.place_id,
      name: l.name,
      category_id: l.category_id != null ? String(l.category_id) : "",
      address: l.address ?? "",
      external_id: l.external_id ?? "",
      radius_m: l.radius_m ?? 250,
      lat: l.center?.[0] ?? null,
      lon: l.center?.[1] ?? null,
      geom: esPoligono(l) ? "polygon" : "circle",
      cerrado: esPoligono(l),
      pasado: [],
      futuro: [],
      vertices: esPoligono(l) ? (l.polygon ?? []) : [],
      icon: iconoDeLugar(l),
      metadata: metadataAFilas(l.metadata),
      active_from: l.active_from?.slice(0, 10) ?? "",
      active_until: l.active_until?.slice(0, 10) ?? "",
    });
    centrarEnVista(anclaLugar(l));
  };

  const guardarLugar = async () => {
    if (!form.name) {
      setMsg("Falta el nombre.");
      return;
    }
    if (form.geom === "circle" && form.lat == null) {
      setMsg("Fija el centro con clic en el mapa.");
      return;
    }
    if (form.geom === "polygon" && form.vertices.length < 3) {
      setMsg("El polígono necesita al menos 3 vértices.");
      return;
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
    setGuardando(false);
    setMsg(
      form.place_id
        ? "Lugar actualizado."
        : "Lugar creado y proyectado a geocercas."
    );
    setForm({ ...FORM_VACIO });
    setModo("ver");
    refrescarTodo();
  };

  const guardarLugarLocal = (placeId: string, okMsg: string) => {
    const ok = local.saveLugar(lugarDesdeForm(form, cats ?? [], placeId));
    setMsg(
      ok
        ? okMsg
        : "No se pudo guardar localmente (almacenamiento lleno o bloqueado)."
    );
    if (!ok) return;
    setForm({ ...FORM_VACIO });
    setModo("ver");
  };

  const borrarLugar = (l: Lugar) =>
    confirmar(
      "Eliminar lugar",
      <>
        ¿Eliminar <b>{l.name}</b>? Se retira su geocerca.
      </>,
      () => void eliminarLugar(l)
    );

  const eliminarLugar = async (l: Lugar) => {
    // si estaba abierto en la ventana flotante, cerrarla
    if (modo === "lugar" && form.place_id === l.place_id) cerrarForm();
    // siempre quitar la copia local (lugar local o edición guardada offline)
    const habiaCopiaLocal = local.lugares.some(
      (x) => x.place_id === l.place_id
    );
    local.deleteLugar(l.place_id);
    if (isLocalId(l.place_id)) {
      setMsg("Lugar local eliminado.");
      return;
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
    setTray({
      ...TRAY_VACIO,
      id: t.trayecto_id,
      name: t.name,
      icon: t.icon ?? "",
      kind: (t.kind as "vial" | "interno") ?? "vial",
      width_m: t.width_m ?? 30,
      external_id: t.external_id ?? "",
      pts: (t.waypoints?.length ? t.waypoints : t.points) ?? [],
      ajustado: !!t.ajustado,
      vias: [],
    });
    // punto medio del recorrido, no su inicio
    centrarEnVista(t.points[Math.floor(t.points.length / 2)] ?? null);
  };

  const ajustarTray = async () => {
    if (!MAPBOX_TOKEN) return;
    setGuardando(true);
    const aj = await ajustarACalles(tray.pts, MAPBOX_TOKEN);
    setGuardando(false);
    if (!aj) {
      setMsg("No se pudo ajustar a calles (máx. 25 puntos, revisa la ruta).");
      return;
    }
    setTray((t) => ({ ...t, ajustado: true, vias: aj.vias }));
    setMsg(
      `Ajustado a calles: ${aj.vias.slice(0, 4).join(", ")}${aj.vias.length > 4 ? "…" : ""}`
    );
    setTrayPathAjustado(aj.pts);
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

  /** Cambiar de método empieza el recorrido de cero (conserva los datos). */
  const cambiarMetodo = (metodo: MetodoTrayecto) => {
    if (metodo === tray.metodo) return;
    setTray((t) => ({
      ...TRAY_VACIO,
      id: t.id,
      name: t.name,
      icon: t.icon,
      kind: t.kind,
      width_m: t.width_m,
      external_id: t.external_id,
      metodo,
    }));
    setTrayPathAjustado(null);
    setMsg(null);
  };

  // Las respuestas de Directions pueden llegar fuera de orden: solo vale la
  // de la última petición.
  const rutaSeq = useRef(0);

  const trazarRuta = async (pts: [number, number][], nombre: string) => {
    const seq = ++rutaSeq.current;
    setTray((t) => ({ ...t, pts, ajustado: false, name: t.name || nombre }));
    setTrayPathAjustado(null);
    if (tray.kind !== "vial" || !MAPBOX_TOKEN) {
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
    setMsg(
      `Ruta por: ${aj.vias.slice(0, 4).join(", ")}${aj.vias.length > 4 ? "…" : ""}`
    );
    encuadrarRuta(aj.pts);
  };

  /**
   * Aplica un cambio al recorrido A → paradas → B. Con el recorrido completo
   * traza la ruta; si no, descarta la anterior y centra `foco` si lo hay.
   */
  const aplicarRecorrido = (
    cambio: (t: FormTrayecto) => FormTrayecto,
    foco?: [number, number]
  ) => {
    const next = cambio(tray);
    if (next === tray) return;
    setTray(next);
    setMsg(null);
    const pts = puntosRecorrido(next);
    if (pts) {
      void trazarRuta(pts, nombreRecorrido(next));
      return;
    }
    rutaSeq.current++; // ignora una ruta que estuviera en camino
    setGuardando(false);
    setTrayPathAjustado(null);
    if (foco) centrarEnVista(foco);
  };

  const guardarTrayecto = async () => {
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

  // ── Circuitos: secuencia de lugares por referencia ──
  const agregarStop = (l: Lugar) => {
    setCirc((c) => ({
      ...c,
      stops: [
        ...c.stops,
        {
          place_id: l.place_id,
          name: l.name,
          stop_kind: c.stops.length === 0 ? "origen" : "destino",
        },
      ],
    }));
  };
  const editarCircuito = (c: Circuito) => {
    setModo("circuito");
    setMsg(null);
    setCirc({
      id: c.route_id,
      name: c.name,
      via_label: c.via_label ?? "",
      cerrado: c.cerrado,
      stops: c.stops.map((s) => ({
        place_id: s.place_id,
        name: s.name ?? s.place_id,
        stop_kind: s.stop_kind,
      })),
      path: c.path_points ?? [],
      ajustado: c.ajustado,
      vias: [],
    });
  };
  const ajustarCirc = async () => {
    if (!MAPBOX_TOKEN) return;
    const centros = circ.stops
      .map(
        (s) =>
          (propios ?? [])
            .concat(globales ?? [])
            .find((l) => l.place_id === s.place_id)?.center
      )
      .filter(Boolean) as [number, number][];
    const pts =
      circ.cerrado && centros.length > 1 ? [...centros, centros[0]] : centros;
    setGuardando(true);
    const aj = await ajustarACalles(pts, MAPBOX_TOKEN);
    setGuardando(false);
    if (!aj) {
      setMsg("No se pudo ajustar el circuito a calles.");
      return;
    }
    setCirc((c) => ({ ...c, path: aj.pts, ajustado: true, vias: aj.vias }));
    setMsg(
      `Circuito ajustado por: ${aj.vias.slice(0, 4).join(", ")}${aj.vias.length > 4 ? "…" : ""}`
    );
  };
  const guardarCircuito = async () => {
    if (!circ.name || circ.stops.length < 2) {
      setMsg("Falta nombre o al menos 2 paradas.");
      return;
    }
    if (
      circ.cerrado &&
      circ.stops[0].place_id !== circ.stops[circ.stops.length - 1].place_id &&
      circ.stops.length >= 2
    ) {
      // circuito cerrado: termina donde empieza (regla del lab)
      setCirc((c) => ({
        ...c,
        stops: [...c.stops, { ...c.stops[0], stop_kind: "destino" }],
      }));
    }
    setGuardando(true);
    const stops = circ.stops.map((s, i) => ({
      place_id: s.place_id,
      stop_kind:
        i === 0 ? "origen" : i === circ.stops.length - 1 ? "destino" : "parada",
    }));
    const res = await post("fn_pt4_save_route", {
      p_name: circ.name,
      p_stops: stops,
      p_route_id: circ.id,
      p_via_label: circ.via_label || null,
      p_cerrado: circ.cerrado,
      p_path_points: circ.path.length ? circ.path : null,
      p_vias: circ.vias.length ? circ.vias : null,
      p_ajustado: circ.ajustado,
      p_actor: "app-settings",
    });
    setGuardando(false);
    if (res?.ok === false) {
      setMsg(`No guardado — ${res?.detalle ?? res?.error}`);
      return;
    }
    setMsg(circ.id ? "Circuito actualizado." : "Circuito guardado.");
    setCirc({
      id: null,
      name: "",
      via_label: "",
      cerrado: false,
      stops: [],
      path: [],
      ajustado: false,
      vias: [],
    });
    setModo("ver");
    refrescarTodo();
  };
  const borrarCircuito = (c: Circuito) =>
    confirmar(
      "Eliminar circuito",
      <>
        ¿Eliminar el circuito <b>{c.name}</b>?
      </>,
      () => void eliminarCircuito(c)
    );

  const eliminarCircuito = async (c: Circuito) => {
    const res = await post("fn_pt4_delete_route", {
      p_route_id: c.route_id,
      p_actor: "app-settings",
    });
    setMsg(
      res?.ok === false
        ? `No eliminado — ${res?.detalle ?? res?.error}`
        : "Circuito eliminado."
    );
    refrescarTodo();
  };

  // ── Importación masiva ──
  const onArchivo = async (file: File) => {
    try {
      const { formato, filas } = await parsearArchivo(file);
      setImp((s) => ({
        ...s,
        filename: file.name,
        formato,
        filas,
        resultado: null,
      }));
      if (!filas.length)
        setMsg(
          "El archivo no tiene filas válidas (se esperan columnas name/lat/lon o Placemarks)."
        );
    } catch {
      setMsg("No se pudo leer el archivo.");
    }
  };
  const confirmarImport = async () => {
    setGuardando(true);
    const res = await post("fn_pt4_import_places", {
      p_filename: imp.filename,
      p_format: imp.formato,
      p_rows: imp.filas,
      p_defaults: {
        radius_m: imp.radioDef,
        category_id: imp.catDef ? Number(imp.catDef) : null,
      },
      p_actor: "app-settings",
    });
    setGuardando(false);
    if (res?.ok === false) {
      setImp((s) => ({
        ...s,
        resultado: `No importado — ${res?.detalle ?? res?.error}`,
      }));
      return;
    }
    setImp((s) => ({
      ...s,
      resultado: `Importadas ${res?.creadas ?? 0} · rechazadas ${res?.rechazadas ?? 0}`,
      filas: [],
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

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* mapa: columna flexible; el panel vive AL LADO, no encima */}
      <div className="relative flex-1 min-w-0 h-full">
        <MapVisualization
          rounded={false}
          mapStyle={mapStyle}
          layers={NO_DECK_LAYERS}
          mapRef={mapRef}
          initialViewState={PLACES_INITIAL_VIEW}
          onMapClick={onMapClick}
          onMapContextMenu={onMapContextMenu}
          idleCursor={clicAgrega ? CURSOR_AGREGAR : undefined}
        >
          {carrierMode && (
            <Source
              id="globales"
              type="geojson"
              tolerance={GEOJSON_EXACTO}
              data={fcGlobales}
            >
              <Layer
                id="glob-fill"
                type="fill"
                paint={{
                  "fill-color": ["get", "color"],
                  "fill-opacity": 0.12,
                }}
              />
              <Layer
                id="glob-line"
                type="line"
                paint={{
                  "line-color": ["get", "color"],
                  "line-width": 1,
                  "line-dasharray": [2, 2],
                }}
              />
            </Source>
          )}
          <Source
            id="propios"
            type="geojson"
            tolerance={GEOJSON_EXACTO}
            data={fcPropios}
          >
            <Layer
              id="prop-fill"
              type="fill"
              paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.22 }}
            />
            <Layer
              id="prop-line"
              type="line"
              paint={{ "line-color": ["get", "color"], "line-width": 1.5 }}
            />
          </Source>
          <Source
            id="tray"
            type="geojson"
            tolerance={GEOJSON_EXACTO}
            data={fcTray}
          >
            <Layer
              id="tray-line"
              type="line"
              paint={{
                "line-color": "#7E3AF2",
                "line-width": 2.5,
                "line-opacity": 0.8,
              }}
            />
          </Source>
          <Source
            id="circ"
            type="geojson"
            tolerance={GEOJSON_EXACTO}
            data={fcCirc}
          >
            <Layer
              id="circ-line"
              type="line"
              paint={{
                "line-color": "#0E9F6E",
                "line-width": 2.5,
                "line-opacity": 0.8,
                "line-dasharray": [3, 1.5],
              }}
            />
          </Source>

          {/* previews en edición — Sources SIEMPRE montados (react-map-gl no
              permite que un Source cambie de id entre renders); cuando no
              aplican, llevan colección vacía */}
          <Source
            id="prev-lugar"
            type="geojson"
            tolerance={GEOJSON_EXACTO}
            data={prevLugarFC}
          >
            <Layer
              id="prev-lugar-f"
              type="fill"
              paint={{ "fill-color": "#1C64F2", "fill-opacity": 0.22 }}
            />
            <Layer
              id="prev-lugar-l"
              type="line"
              paint={{ "line-color": "#1C64F2", "line-width": 2 }}
            />
          </Source>
          <Source
            id="prev-tray-raw"
            type="geojson"
            tolerance={GEOJSON_EXACTO}
            data={prevTrayRawFC}
          >
            <Layer
              id="prev-tray-raw-l"
              type="line"
              paint={{
                "line-color": "#7E3AF2",
                "line-width": 2,
                "line-dasharray": [2, 2],
              }}
            />
          </Source>
          <Source
            id="prev-tray-adj"
            type="geojson"
            tolerance={GEOJSON_EXACTO}
            data={prevTrayAdjFC}
          >
            <Layer
              id="prev-tray-adj-l"
              type="line"
              paint={{ "line-color": "#7E3AF2", "line-width": 3 }}
            />
          </Source>
          <Source
            id="prev-circ"
            type="geojson"
            tolerance={GEOJSON_EXACTO}
            data={prevCircFC}
          >
            <Layer
              id="prev-circ-l"
              type="line"
              paint={{ "line-color": "#0E9F6E", "line-width": 3 }}
            />
          </Source>
          <PlaceLabels
            lugares={todosLugares}
            ocultarId={editandoLugarId}
            interactivo={modo === "ver"}
            onSelect={editarLugar}
          />
          {modo === "lugar" && (
            <PlaceLabelPreview
              ancla={anclaLugar({
                polygon: form.geom === "polygon" ? form.vertices : null,
                center:
                  form.geom === "circle" && form.lat != null && form.lon != null
                    ? [form.lat, form.lon]
                    : null,
              })}
              icon={form.icon}
              name={form.name}
              color={
                cats?.find((c) => String(c.category_id) === form.category_id)
                  ?.color ?? "#1C64F2"
              }
            />
          )}
          {modo === "lugar" && (
            <GeofenceHandles form={form} setForm={setForm} />
          )}
          {modo === "trayecto" &&
            (tray.metodo === "manual" ? (
              <RoutePointHandles pts={tray.pts} onMove={moverPuntoTray} />
            ) : (
              <RouteEndpoints puntos={tray.recorrido.map((p) => p.punto)} />
            ))}
        </MapVisualization>
        {menu && (
          <MapCreateMenu
            x={menu.x}
            y={menu.y}
            onCrearLugar={crearLugarAqui}
            onCrearTrayecto={crearTrayectoAqui}
            onClose={cerrarMenu}
          />
        )}
        {modo === "lugar" &&
          form.geom === "polygon" &&
          // también sin puntos si queda algo por deshacer/rehacer
          (form.vertices.length > 0 ||
            puedeDeshacer(form) ||
            puedeRehacer(form)) && (
            <PolygonDrawToolbar
              puntos={form.vertices.length}
              cerrado={form.cerrado}
              onSeguir={seguirPoligono}
              puedeTerminar={puedeTerminar(form)}
              onTerminar={terminarPoligono}
              puedeDeshacer={puedeDeshacer(form)}
              puedeRehacer={puedeRehacer(form)}
              onDeshacer={deshacerPunto}
              onRehacer={rehacerPunto}
              onCancelar={cancelarPoligono}
            />
          )}
        {modo === "lugar" && (
          <PlaceForm
            form={form}
            setForm={setForm}
            cats={cats ?? []}
            guardando={guardando}
            msg={msg}
            onSave={() => void guardarLugar()}
            onClose={cerrarForm}
          />
        )}
        {modo === "trayecto" && (
          <TrayectoForm
            token={MAPBOX_TOKEN}
            cerca={centroMapa}
            onMetodo={cambiarMetodo}
            onRecorrido={aplicarRecorrido}
            tray={tray}
            setTray={setTray}
            guardando={guardando}
            msg={msg}
            onUndoPoint={deshacerPuntoTray}
            onAjustar={() => void ajustarTray()}
            onSave={() => void guardarTrayecto()}
            onClose={cerrarForm}
          />
        )}
        <div className="absolute bottom-5 left-5 z-40">
          <MapStyleSelector
            dict={dict}
            selectedStyle={mapStyle}
            setSelectedStyle={(style) => setMapStyle(style as MapStyleName)}
          />
        </div>
      </div>

      {/* Panel lateral a la DERECHA del mapa (columna propia, no flotante) */}
      <div className="w-[380px] flex-none h-full flex flex-col gap-2 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 overflow-y-auto">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lugares de interés
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {carrierMode
              ? "Tus lugares, trayectos y circuitos. Lo oficial de la operación se ve punteado (solo lectura)."
              : "Capa global de la operación: lugares, trayectos, circuitos e importación masiva."}
          </p>
        </div>

        {carrierMode && cuotas && (
          <div className="flex gap-2 text-[11px]">
            <span className="rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-700 dark:text-gray-300">
              lugares <b>{cuotas.lugares.usadas}</b>/{cuotas.lugares.limite}
            </span>
            <span className="rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-700 dark:text-gray-300">
              trayectos+circuitos <b>{cuotas.trayectos.usadas}</b>/
              {cuotas.trayectos.limite}
            </span>
          </div>
        )}

        <p className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-600 dark:text-gray-400">
          Haz clic derecho en el mapa para crear un lugar o un trayecto en ese
          punto.
        </p>

        <div className="flex gap-1.5">
          <button
            className={btnTab(modo === "circuito", "bg-green-600")}
            onClick={() => {
              setMenu(null);
              setModo(modo === "circuito" ? "ver" : "circuito");
              setCirc({
                id: null,
                name: "",
                via_label: "",
                cerrado: false,
                stops: [],
                path: [],
                ajustado: false,
                vias: [],
              });
              setMsg(null);
            }}
          >
            + Circuito
          </button>
          <button
            className={btnTab(modo === "import", "bg-amber-600")}
            onClick={() => {
              setMenu(null);
              setModo(modo === "import" ? "ver" : "import");
              setMsg(null);
            }}
          >
            Importar
          </button>
        </div>

        {/* ── Formulario de CIRCUITO ── */}
        {modo === "circuito" && (
          <div className="space-y-2 rounded-lg border border-green-300 dark:border-green-800 p-3">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {circ.id ? "Editar circuito" : "Nuevo circuito"} — agrega paradas
              con «+» en la lista de lugares
            </div>
            <input
              className={inp}
              placeholder="Nombre *"
              value={circ.name}
              onChange={(e) => setCirc({ ...circ, name: e.target.value })}
            />
            <input
              className={inp}
              placeholder="Vía (ej: vía Ruta 68)"
              value={circ.via_label}
              onChange={(e) => setCirc({ ...circ, via_label: e.target.value })}
            />
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={circ.cerrado}
                onChange={(e) =>
                  setCirc({ ...circ, cerrado: e.target.checked })
                }
              />
              Circuito cerrado (termina donde empieza)
            </label>
            <div className="space-y-1">
              {circ.stops.map((s, i) => (
                <div
                  key={`${s.place_id}-${i}`}
                  className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200"
                >
                  <span className="w-5 text-gray-500">{i + 1}.</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-gray-500">
                    {i === 0
                      ? "origen"
                      : i === circ.stops.length - 1
                        ? "destino"
                        : "parada"}
                  </span>
                  <button
                    className="text-rose-600"
                    onClick={() =>
                      setCirc({
                        ...circ,
                        stops: circ.stops.filter((_, j) => j !== i),
                        ajustado: false,
                        path: [],
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              {!circ.stops.length && (
                <div className="text-[11px] text-gray-500">
                  Sin paradas aún.
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                className="flex-1 rounded-lg border border-green-500 text-xs py-1.5 text-green-700 dark:text-green-300 disabled:opacity-50"
                disabled={circ.stops.length < 2 || guardando}
                onClick={() => void ajustarCirc()}
              >
                {circ.ajustado ? "✓ Ajustado a calles" : "Ajustar a calles"}
              </button>
              <button
                onClick={() => void guardarCircuito()}
                disabled={guardando}
                className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1.5 disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Guardar circuito"}
              </button>
            </div>
          </div>
        )}

        {/* ── Importación masiva ── */}
        {modo === "import" && (
          <div className="space-y-2 rounded-lg border border-amber-300 dark:border-amber-800 p-3">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              Importación masiva de lugares
            </div>
            <div className="text-[11px] text-gray-500">
              Formatos: CSV (columnas name, lat, lon y opcionales radius_m,
              address, external_id), KML y KMZ. Máximo 500 filas.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.kml,.kmz"
              className="text-xs text-gray-700 dark:text-gray-300"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onArchivo(f);
              }}
            />
            {imp.filas.length > 0 && (
              <>
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  <b>{imp.filas.length}</b> filas válidas de «{imp.filename}» (
                  {imp.formato})
                </div>
                <div className="max-h-[120px] overflow-y-auto text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5">
                  {imp.filas.slice(0, 8).map((f, i) => (
                    <div key={i} className="truncate">
                      · {String(f.name)} ({Number(f.lat).toFixed(3)},{" "}
                      {Number(f.lon).toFixed(3)})
                    </div>
                  ))}
                  {imp.filas.length > 8 && (
                    <div>… y {imp.filas.length - 8} más</div>
                  )}
                </div>
                <div className="flex gap-1.5 items-center text-[11px] text-gray-500">
                  <span>Radio def.</span>
                  <input
                    type="number"
                    className={inp}
                    value={imp.radioDef}
                    onChange={(e) =>
                      setImp({ ...imp, radioDef: Number(e.target.value) })
                    }
                  />
                  <select
                    className={inp}
                    value={imp.catDef}
                    onChange={(e) => setImp({ ...imp, catDef: e.target.value })}
                  >
                    <option value="">Sin categoría</option>
                    {(cats ?? []).map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => void confirmarImport()}
                  disabled={guardando}
                  className="w-full rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-1.5 disabled:opacity-50"
                >
                  {guardando
                    ? "Importando…"
                    : `Confirmar importación (${imp.filas.length})`}
                </button>
              </>
            )}
            {imp.resultado && (
              <div className="text-xs text-gray-700 dark:text-gray-300">
                {imp.resultado}
              </div>
            )}
          </div>
        )}

        {/* con la ventana flotante abierta, el mensaje vive en ella */}
        {msg && modo !== "lugar" && modo !== "trayecto" && (
          <div className="text-xs text-gray-700 dark:text-gray-300">{msg}</div>
        )}

        <input
          className={inp}
          placeholder="Buscar por nombre, dirección o external_id…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <PlaceList
          lugares={lugares}
          busqueda={busca}
          seleccionadoId={editandoLugarId}
          modoCircuito={modo === "circuito"}
          onIr={irALugar}
          onEditar={editarLugar}
          onEliminar={(l) => void borrarLugar(l)}
          onAgregarAlCircuito={agregarStop}
        />

        <TrayectoList
          trayectos={todosTrayectos}
          seleccionadoId={editandoTrayId}
          onIr={irATrayecto}
          onEditar={editarTrayecto}
          onEliminar={(t) => void borrarTrayecto(t)}
        />

        <div className="pb-2">
          <CircuitoList
            circuitos={circuitos ?? []}
            seleccionadoId={modo === "circuito" ? circ.id : null}
            onIr={irACircuito}
            onEditar={editarCircuito}
            onEliminar={(c) => void borrarCircuito(c)}
          />
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmacion !== null}
        onClose={() => setConfirmacion(null)}
        onConfirm={() => confirmacion?.accion()}
        title={confirmacion?.titulo ?? ""}
        description={confirmacion?.descripcion}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}

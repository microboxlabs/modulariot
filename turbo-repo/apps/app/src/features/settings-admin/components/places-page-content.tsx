"use client";

// PT4-b2 · Settings › Lugares de interés — F3 portado del laboratorio,
// COMPLETO contra el mockup validado (feedback Erick 2026-07-23):
// panel a la DERECHA (misma lógica del replay), formulario de lugar con
// geometría circle/polygon + metadata + external_id + vigencia, trayectos
// con ancho/tipo/ajuste a calles (Mapbox Directions), CIRCUITOS (secuencia
// de lugares por referencia, cerrado, ajustado) e IMPORTACIÓN MASIVA
// (csv/kml/kmz). Crear y editar son EL MISMO formulario. Carrier: capa
// global punteada read-only + cuotas 600/9. Tenant SIEMPRE server-side.
import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import MapboxMap, { Source, Layer, Marker, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Feature, FeatureCollection, Polygon, LineString } from "geojson";
import JSZip from "jszip";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});
const post = (fn: string, body: Record<string, unknown>) =>
  fetch(`/app/api/atc/rpc/${fn}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }).then((r) => r.json());

type Lugar = {
  place_id: string; name: string; address: string | null; category: string | null;
  category_id: number | null; geometry_type: string | null;
  color: string | null; center: [number, number] | null;   // [lat, lon] (lab)
  polygon: [number, number][] | null; radius_m: number | null;
  metadata: Record<string, string> | null; external_id: string | null;
  active_from: string | null; active_until: string | null;
};
type Trayecto = {
  trayecto_id: string; name: string; kind: string; width_m: number | null;
  points: [number, number][]; waypoints: [number, number][] | null;
  parent_name: string | null; ajustado: boolean | null; external_id: string | null;
};
type Stop = { place_id: string; name: string | null; stop_kind: string; center: [number, number] | null };
type Circuito = {
  route_id: string; name: string; via_label: string | null; cerrado: boolean;
  ajustado: boolean; path_points: [number, number][] | null; stops: Stop[];
};
type Categoria = { category_id: number; name: string; color: string };
type Cuota = { usadas: number; limite: number };

function circuloPoly(lat: number, lon: number, radioM: number): [number, number][] {
  const pts: [number, number][] = [];
  const dLat = radioM / 111_320;
  const dLon = radioM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 48; i++) {
    const a = (2 * Math.PI * i) / 48;
    pts.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return pts;
}

function fcLugares(lugares: Lugar[], propios: boolean): FeatureCollection {
  const features: Feature[] = [];
  for (const l of lugares) {
    if (!l.center && !l.polygon) continue;
    const ring: [number, number][] = l.polygon
      ? l.polygon.map(([la, lo]) => [lo, la] as [number, number])
      : circuloPoly(l.center![0], l.center![1], l.radius_m ?? 250);
    features.push({ type: "Feature",
      properties: { name: l.name, color: l.color ?? (propios ? "#1C64F2" : "#6B7280") },
      geometry: { type: "Polygon", coordinates: [ring] } as Polygon });
  }
  return { type: "FeatureCollection", features };
}
const fcLineas = (xs: { pts: [number, number][] }[], _color: string): FeatureCollection => ({
  type: "FeatureCollection",
  features: xs.filter((x) => x.pts?.length > 1).map((x) => ({
    type: "Feature", properties: {},
    geometry: { type: "LineString", coordinates: x.pts.map(([la, lo]) => [lo, la]) } as LineString,
  })),
});

// [lat,lon][] → Mapbox Directions (driving) → [lat,lon][] pegado a calles
async function ajustarACalles(pts: [number, number][], token: string):
  Promise<{ pts: [number, number][]; vias: string[] } | null> {
  if (pts.length < 2 || pts.length > 25) return null;
  const coords = pts.map(([la, lo]) => `${lo},${la}`).join(";");
  const r = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&steps=true&access_token=${token}`);
  if (!r.ok) return null;
  const j = await r.json();
  const ruta = j?.routes?.[0];
  if (!ruta?.geometry?.coordinates) return null;
  const vias = new Set<string>();
  for (const leg of ruta.legs ?? [])
    for (const st of leg.steps ?? [])
      if (st.name) vias.add(st.name);
  return { pts: ruta.geometry.coordinates.map(([lo, la]: number[]) => [la, lo] as [number, number]),
           vias: [...vias].slice(0, 12) };
}

// CSV/KML/KMZ → filas {name, lat, lon, radius_m?, address?, external_id?}
async function parsearArchivo(file: File): Promise<{ formato: string; filas: Record<string, unknown>[] }> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const filasKml = (xml: string) => {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return [...doc.querySelectorAll("Placemark")].map((pm) => {
      const coord = pm.querySelector("Point coordinates")?.textContent?.trim().split(",");
      return {
        name: pm.querySelector("name")?.textContent?.trim() ?? "Sin nombre",
        address: pm.querySelector("address")?.textContent?.trim() ?? null,
        lon: coord ? Number(coord[0]) : null, lat: coord ? Number(coord[1]) : null,
      };
    }).filter((r) => r.lat != null && r.lon != null);
  };
  if (ext === "kml") return { formato: "kml", filas: filasKml(await file.text()) };
  if (ext === "kmz") {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".kml"));
    return { formato: "kmz", filas: entry ? filasKml(await entry.async("text")) : [] };
  }
  // CSV: cabecera con name/nombre, lat, lon/lng, radius_m/radio, address/direccion, external_id
  const lineas = (await file.text()).split(/\r?\n/).filter((x) => x.trim());
  const sep = lineas[0]?.includes(";") ? ";" : ",";
  const head = lineas[0].split(sep).map((h) => h.trim().toLowerCase());
  const col = (r: string[], ...names: string[]) => {
    for (const n of names) { const i = head.indexOf(n); if (i >= 0 && r[i]?.trim()) return r[i].trim(); }
    return null;
  };
  const filas = lineas.slice(1).map((ln) => {
    const r = ln.split(sep);
    return {
      name: col(r, "name", "nombre") ?? "Sin nombre",
      lat: Number(col(r, "lat", "latitud")), lon: Number(col(r, "lon", "lng", "longitud")),
      radius_m: col(r, "radius_m", "radio") ? Number(col(r, "radius_m", "radio")) : undefined,
      address: col(r, "address", "direccion") ?? undefined,
      external_id: col(r, "external_id", "id_externo") ?? undefined,
    };
  }).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
  return { formato: "csv", filas };
}

const FORM_VACIO = {
  place_id: null as string | null, name: "", category_id: "", address: "",
  external_id: "", radius_m: 250, lat: null as number | null, lon: null as number | null,
  geom: "circle" as "circle" | "polygon", vertices: [] as [number, number][], // [lat,lon]
  metadata: [] as { k: string; v: string }[],
  active_from: "", active_until: "",
};
type FormLugar = typeof FORM_VACIO;

export default function PlacesPageContent() {
  const runtimeConfig = useRuntimeConfig();
  const MAPBOX_TOKEN = runtimeConfig?.MAPBOX_API_KEY;
  const { carrierMode } = useCarrierMode();
  const mapRef = useRef<MapRef | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"ver" | "lugar" | "trayecto" | "circuito" | "import">("ver");
  const [form, setForm] = useState<FormLugar>({ ...FORM_VACIO });
  const [mk, setMk] = useState(""); const [mv, setMv] = useState("");
  // trayecto
  const [tray, setTray] = useState({ id: null as string | null, name: "", kind: "vial" as "vial" | "interno",
    width_m: 30, external_id: "", pts: [] as [number, number][], ajustado: false, vias: [] as string[] });
  // circuito
  const [circ, setCirc] = useState({ id: null as string | null, name: "", via_label: "", cerrado: false,
    stops: [] as { place_id: string; name: string; stop_kind: string }[],
    path: [] as [number, number][], ajustado: false, vias: [] as string[] });
  // import
  const [imp, setImp] = useState({ filename: "", formato: "", filas: [] as Record<string, unknown>[],
    radioDef: 250, catDef: "", resultado: null as string | null });
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data: propios, mutate: refP } = useSWR<Lugar[]>("/app/api/atc/rpc/fn_pt4_places", fetcher);
  const { data: globales } = useSWR<Lugar[]>(
    carrierMode ? "/app/api/atc/rpc/fn_pt4_places_global" : null, fetcher);
  const { data: trayectos, mutate: refT } = useSWR<Trayecto[]>("/app/api/atc/rpc/fn_pt4_trayectos", fetcher);
  const { data: circuitos, mutate: refC } = useSWR<Circuito[]>("/app/api/atc/rpc/fn_pt4_circuitos", fetcher);
  const { data: cats } = useSWR<Categoria[]>("/app/api/atc/rpc/fn_pt4_categorias", fetcher);
  const { data: cuotas, mutate: refQ } = useSWR<{ lugares: Cuota; trayectos: Cuota }>(
    carrierMode ? "/app/api/atc/rpc/fn_pt4_quota_status" : null, fetcher);
  const refrescarTodo = () => { void refP(); void refT(); void refC(); void refQ(); };

  const lugares = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const xs = propios ?? [];
    return q ? xs.filter((l) => l.name.toLowerCase().includes(q)
      || (l.address ?? "").toLowerCase().includes(q)
      || (l.external_id ?? "").toLowerCase().includes(q)) : xs;
  }, [propios, busca]);

  const fcPropios = useMemo(() => fcLugares(propios ?? [], true), [propios]);
  const fcGlobales = useMemo(() => fcLugares(globales ?? [], false), [globales]);
  const fcTray = useMemo(() => fcLineas((trayectos ?? []).map((t) => ({ pts: t.points })), "#7E3AF2"), [trayectos]);
  const fcCirc = useMemo(() => fcLineas((circuitos ?? [])
    .map((c) => ({ pts: (c.path_points ?? c.stops.map((s) => s.center).filter(Boolean)) as [number, number][] })), "#0E9F6E"), [circuitos]);

  const onMapClick = (e: { lngLat: { lng: number; lat: number } }) => {
    const la = e.lngLat.lat, lo = e.lngLat.lng;
    if (modo === "lugar") {
      if (form.geom === "circle") setForm((f) => ({ ...f, lat: la, lon: lo }));
      else setForm((f) => ({ ...f, vertices: [...f.vertices, [la, lo]],
        lat: f.lat ?? la, lon: f.lon ?? lo }));
    }
    if (modo === "trayecto") setTray((t) => ({ ...t, pts: [...t.pts, [la, lo]], ajustado: false }));
  };

  const editarLugar = (l: Lugar) => {
    setModo("lugar"); setMsg(null);
    setForm({ place_id: l.place_id, name: l.name,
      category_id: l.category_id != null ? String(l.category_id) : "",
      address: l.address ?? "", external_id: l.external_id ?? "",
      radius_m: l.radius_m ?? 250, lat: l.center?.[0] ?? null, lon: l.center?.[1] ?? null,
      geom: l.polygon ? "polygon" : "circle", vertices: l.polygon ?? [],
      metadata: Object.entries(l.metadata ?? {}).map(([k, v]) => ({ k, v: String(v) })),
      active_from: l.active_from?.slice(0, 10) ?? "", active_until: l.active_until?.slice(0, 10) ?? "" });
    if (l.center) mapRef.current?.flyTo({ center: [l.center[1], l.center[0]], zoom: 13 });
  };

  const guardarLugar = async () => {
    if (!form.name) { setMsg("Falta el nombre."); return; }
    if (form.geom === "circle" && form.lat == null) { setMsg("Fija el centro con clic en el mapa."); return; }
    if (form.geom === "polygon" && form.vertices.length < 3) { setMsg("El polígono necesita al menos 3 vértices."); return; }
    setGuardando(true); setMsg(null);
    const metadata = Object.fromEntries(form.metadata.map((m) => [m.k, m.v]));
    const base = {
      p_name: form.name, p_geometry_type: form.geom,
      p_category_id: form.category_id ? Number(form.category_id) : null,
      p_address: form.address || null, p_lat: form.lat, p_lon: form.lon,
      p_radius_m: form.radius_m,
      p_vertices: form.geom === "polygon" ? form.vertices : null,
      p_metadata: metadata, p_external_id: form.external_id || null, p_actor: "app-settings",
    };
    const res = form.place_id
      ? await post("fn_pt4_update_place", { p_place_id: form.place_id, ...base })
      : await post("fn_pt4_create_place", base);
    if (res?.ok === false) { setGuardando(false); setMsg(`No guardado — ${res?.detalle ?? res?.error}`); return; }
    const pid = form.place_id ?? res?.place_id;
    if (pid && (form.active_from || form.active_until)) {
      await post("fn_pt4_set_validity", { p_place_id: pid,
        p_active_from: form.active_from || null, p_active_until: form.active_until || null,
        p_actor: "app-settings" });
    }
    setGuardando(false);
    setMsg(form.place_id ? "Lugar actualizado." : "Lugar creado y proyectado a geocercas.");
    setForm({ ...FORM_VACIO }); setModo("ver"); refrescarTodo();
  };

  const borrarLugar = async (l: Lugar) => {
    if (!window.confirm(`¿Eliminar «${l.name}»? Se retira su geocerca.`)) return;
    const res = await post("fn_pt4_delete_place", { p_place_id: l.place_id, p_actor: "app-settings" });
    setMsg(res?.ok === false ? `No eliminado — ${res?.detalle ?? res?.error}` : "Lugar eliminado.");
    refrescarTodo();
  };

  const editarTrayecto = (t: Trayecto) => {
    setModo("trayecto"); setMsg(null);
    setTray({ id: t.trayecto_id, name: t.name, kind: (t.kind as "vial" | "interno") ?? "vial",
      width_m: t.width_m ?? 30, external_id: t.external_id ?? "",
      pts: (t.waypoints?.length ? t.waypoints : t.points) ?? [], ajustado: !!t.ajustado, vias: [] });
    if (t.points[0]) mapRef.current?.flyTo({ center: [t.points[0][1], t.points[0][0]], zoom: 11 });
  };

  const ajustarTray = async () => {
    if (!MAPBOX_TOKEN) return;
    setGuardando(true);
    const aj = await ajustarACalles(tray.pts, MAPBOX_TOKEN);
    setGuardando(false);
    if (!aj) { setMsg("No se pudo ajustar a calles (máx. 25 puntos, revisa la ruta)."); return; }
    setTray((t) => ({ ...t, ajustado: true, vias: aj.vias }));
    setMsg(`Ajustado a calles: ${aj.vias.slice(0, 4).join(", ")}${aj.vias.length > 4 ? "…" : ""}`);
    setTrayPathAjustado(aj.pts);
  };
  const [trayPathAjustado, setTrayPathAjustado] = useState<[number, number][] | null>(null);

  const guardarTrayecto = async () => {
    if (!tray.name || tray.pts.length < 2) { setMsg("Falta nombre o al menos 2 puntos."); return; }
    setGuardando(true);
    const res = await post("fn_pt4_save_trayecto", {
      p_name: tray.name, p_kind: tray.kind, p_width_m: tray.width_m,
      p_trayecto_id: tray.id, p_external_id: tray.external_id || null,
      p_points: tray.ajustado && trayPathAjustado ? trayPathAjustado : tray.pts,
      p_waypoints: tray.pts, p_ajustado: tray.ajustado, p_actor: "app-settings",
    });
    setGuardando(false);
    if (res?.ok === false) { setMsg(`No guardado — ${res?.detalle ?? res?.error}`); return; }
    setMsg(tray.id ? "Trayecto actualizado." : "Trayecto guardado.");
    setTray({ id: null, name: "", kind: "vial", width_m: 30, external_id: "", pts: [], ajustado: false, vias: [] });
    setTrayPathAjustado(null); setModo("ver"); refrescarTodo();
  };

  const borrarTrayecto = async (t: Trayecto) => {
    if (!window.confirm(`¿Eliminar trayecto «${t.name}»?`)) return;
    const res = await post("fn_pt4_delete_trayecto", { p_trayecto_id: t.trayecto_id, p_actor: "app-settings" });
    setMsg(res?.ok === false ? `No eliminado — ${res?.detalle ?? res?.error}` : "Trayecto eliminado.");
    refrescarTodo();
  };

  // ── Circuitos: secuencia de lugares por referencia ──
  const agregarStop = (l: Lugar) => {
    setCirc((c) => ({ ...c, stops: [...c.stops, { place_id: l.place_id, name: l.name,
      stop_kind: c.stops.length === 0 ? "origen" : "destino" }] }));
  };
  const editarCircuito = (c: Circuito) => {
    setModo("circuito"); setMsg(null);
    setCirc({ id: c.route_id, name: c.name, via_label: c.via_label ?? "", cerrado: c.cerrado,
      stops: c.stops.map((s) => ({ place_id: s.place_id, name: s.name ?? s.place_id, stop_kind: s.stop_kind })),
      path: c.path_points ?? [], ajustado: c.ajustado, vias: [] });
  };
  const ajustarCirc = async () => {
    if (!MAPBOX_TOKEN) return;
    const centros = circ.stops
      .map((s) => (propios ?? []).concat(globales ?? []).find((l) => l.place_id === s.place_id)?.center)
      .filter(Boolean) as [number, number][];
    const pts = circ.cerrado && centros.length > 1 ? [...centros, centros[0]] : centros;
    setGuardando(true);
    const aj = await ajustarACalles(pts, MAPBOX_TOKEN);
    setGuardando(false);
    if (!aj) { setMsg("No se pudo ajustar el circuito a calles."); return; }
    setCirc((c) => ({ ...c, path: aj.pts, ajustado: true, vias: aj.vias }));
    setMsg(`Circuito ajustado por: ${aj.vias.slice(0, 4).join(", ")}${aj.vias.length > 4 ? "…" : ""}`);
  };
  const guardarCircuito = async () => {
    if (!circ.name || circ.stops.length < 2) { setMsg("Falta nombre o al menos 2 paradas."); return; }
    if (circ.cerrado && circ.stops[0].place_id !== circ.stops[circ.stops.length - 1].place_id
        && circ.stops.length >= 2) {
      // circuito cerrado: termina donde empieza (regla del lab)
      setCirc((c) => ({ ...c, stops: [...c.stops, { ...c.stops[0], stop_kind: "destino" }] }));
    }
    setGuardando(true);
    const stops = circ.stops.map((s, i) => ({ place_id: s.place_id,
      stop_kind: i === 0 ? "origen" : i === circ.stops.length - 1 ? "destino" : "parada" }));
    const res = await post("fn_pt4_save_route", {
      p_name: circ.name, p_stops: stops, p_route_id: circ.id,
      p_via_label: circ.via_label || null, p_cerrado: circ.cerrado,
      p_path_points: circ.path.length ? circ.path : null,
      p_vias: circ.vias.length ? circ.vias : null, p_ajustado: circ.ajustado,
      p_actor: "app-settings",
    });
    setGuardando(false);
    if (res?.ok === false) { setMsg(`No guardado — ${res?.detalle ?? res?.error}`); return; }
    setMsg(circ.id ? "Circuito actualizado." : "Circuito guardado.");
    setCirc({ id: null, name: "", via_label: "", cerrado: false, stops: [], path: [], ajustado: false, vias: [] });
    setModo("ver"); refrescarTodo();
  };
  const borrarCircuito = async (c: Circuito) => {
    if (!window.confirm(`¿Eliminar circuito «${c.name}»?`)) return;
    const res = await post("fn_pt4_delete_route", { p_route_id: c.route_id, p_actor: "app-settings" });
    setMsg(res?.ok === false ? `No eliminado — ${res?.detalle ?? res?.error}` : "Circuito eliminado.");
    refrescarTodo();
  };

  // ── Importación masiva ──
  const onArchivo = async (file: File) => {
    try {
      const { formato, filas } = await parsearArchivo(file);
      setImp((s) => ({ ...s, filename: file.name, formato, filas, resultado: null }));
      if (!filas.length) setMsg("El archivo no tiene filas válidas (se esperan columnas name/lat/lon o Placemarks).");
    } catch {
      setMsg("No se pudo leer el archivo.");
    }
  };
  const confirmarImport = async () => {
    setGuardando(true);
    const res = await post("fn_pt4_import_places", {
      p_filename: imp.filename, p_format: imp.formato, p_rows: imp.filas,
      p_defaults: { radius_m: imp.radioDef, category_id: imp.catDef ? Number(imp.catDef) : null },
      p_actor: "app-settings",
    });
    setGuardando(false);
    if (res?.ok === false) { setImp((s) => ({ ...s, resultado: `No importado — ${res?.detalle ?? res?.error}` })); return; }
    setImp((s) => ({ ...s, resultado: `Importadas ${res?.creadas ?? 0} · rechazadas ${res?.rechazadas ?? 0}`, filas: [] }));
    refrescarTodo();
  };

  const inp = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white";
  const btnTab = (activo: boolean, color = "bg-blue-600") =>
    `flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${activo ? `${color} text-white`
      : "border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"}`;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {MAPBOX_TOKEN ? (
        <MapboxMap ref={mapRef} mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{ longitude: -70.9, latitude: -33.3, zoom: 6.5 }}
          mapStyle="mapbox://styles/mapbox/streets-v9"
          onClick={onMapClick} style={{ width: "100%", height: "100%" }}>
          {carrierMode && (
            <Source id="globales" type="geojson" data={fcGlobales}>
              <Layer id="glob-fill" type="fill" paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.12 }} />
              <Layer id="glob-line" type="line" paint={{ "line-color": ["get", "color"], "line-width": 1, "line-dasharray": [2, 2] }} />
            </Source>
          )}
          <Source id="propios" type="geojson" data={fcPropios}>
            <Layer id="prop-fill" type="fill" paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.22 }} />
            <Layer id="prop-line" type="line" paint={{ "line-color": ["get", "color"], "line-width": 1.5 }} />
          </Source>
          <Source id="tray" type="geojson" data={fcTray}>
            <Layer id="tray-line" type="line" paint={{ "line-color": "#7E3AF2", "line-width": 2.5, "line-opacity": 0.8 }} />
          </Source>
          <Source id="circ" type="geojson" data={fcCirc}>
            <Layer id="circ-line" type="line" paint={{ "line-color": "#0E9F6E", "line-width": 2.5, "line-opacity": 0.8, "line-dasharray": [3, 1.5] }} />
          </Source>

          {/* previews en edición */}
          {modo === "lugar" && form.geom === "circle" && form.lat != null && (
            <Source id="prev" type="geojson" data={{ type: "Feature", properties: {},
              geometry: { type: "Polygon", coordinates: [circuloPoly(form.lat, form.lon!, form.radius_m)] } } as Feature}>
              <Layer id="prev-f" type="fill" paint={{ "fill-color": "#1C64F2", "fill-opacity": 0.25 }} />
              <Layer id="prev-l" type="line" paint={{ "line-color": "#1C64F2", "line-width": 2 }} />
            </Source>
          )}
          {modo === "lugar" && form.geom === "polygon" && form.vertices.length >= 2 && (
            <Source id="prevpoly" type="geojson" data={{ type: "Feature", properties: {},
              geometry: { type: "Polygon", coordinates: [[...form.vertices.map(([la, lo]) => [lo, la]),
                [form.vertices[0][1], form.vertices[0][0]]]] } } as Feature}>
              <Layer id="prevp-f" type="fill" paint={{ "fill-color": "#1C64F2", "fill-opacity": 0.2 }} />
              <Layer id="prevp-l" type="line" paint={{ "line-color": "#1C64F2", "line-width": 2 }} />
            </Source>
          )}
          {modo === "lugar" && form.geom === "polygon" && form.vertices.map((v, i) => (
            <Marker key={i} longitude={v[1]} latitude={v[0]}>
              <span className="block w-2 h-2 rounded-full bg-blue-600 border border-white" />
            </Marker>
          ))}
          {modo === "trayecto" && (trayPathAjustado && tray.ajustado
            ? (
              <Source id="prevtr" type="geojson" data={{ type: "Feature", properties: {},
                geometry: { type: "LineString", coordinates: trayPathAjustado.map(([la, lo]) => [lo, la]) } } as Feature}>
                <Layer id="prevtr-l" type="line" paint={{ "line-color": "#7E3AF2", "line-width": 3 }} />
              </Source>
            ) : tray.pts.length > 1 && (
              <Source id="prevtr2" type="geojson" data={{ type: "Feature", properties: {},
                geometry: { type: "LineString", coordinates: tray.pts.map(([la, lo]) => [lo, la]) } } as Feature}>
                <Layer id="prevtr2-l" type="line" paint={{ "line-color": "#7E3AF2", "line-width": 2, "line-dasharray": [2, 2] }} />
              </Source>
            ))}
          {modo === "trayecto" && tray.pts.map((p, i) => (
            <Marker key={i} longitude={p[1]} latitude={p[0]}>
              <span className="block w-2.5 h-2.5 rounded-full bg-purple-600 border-2 border-white" />
            </Marker>
          ))}
          {modo === "circuito" && circ.path.length > 1 && (
            <Source id="prevci" type="geojson" data={{ type: "Feature", properties: {},
              geometry: { type: "LineString", coordinates: circ.path.map(([la, lo]) => [lo, la]) } } as Feature}>
              <Layer id="prevci-l" type="line" paint={{ "line-color": "#0E9F6E", "line-width": 3 }} />
            </Source>
          )}
        </MapboxMap>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-gray-500">
          Falta MAPBOX_API_KEY en la configuración de runtime.
        </div>
      )}

      {/* Panel flotante a la DERECHA (misma lógica del replay) */}
      <div className="absolute top-4 right-4 bottom-4 w-[360px] flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-2xl p-4 overflow-y-auto">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Lugares de interés</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {carrierMode
              ? "Tus lugares, trayectos y circuitos. Lo oficial de la operación se ve punteado (solo lectura)."
              : "Capa global de la operación: lugares, trayectos, circuitos e importación masiva."}
          </p>
        </div>

        {carrierMode && cuotas && (
          <div className="flex gap-2 text-[11px]">
            <span className="rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-700 dark:text-gray-300">
              lugares <b>{cuotas.lugares.usadas}</b>/{cuotas.lugares.limite}</span>
            <span className="rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-700 dark:text-gray-300">
              trayectos+circuitos <b>{cuotas.trayectos.usadas}</b>/{cuotas.trayectos.limite}</span>
          </div>
        )}

        <div className="flex gap-1.5">
          <button className={btnTab(modo === "lugar")}
                  onClick={() => { setModo(modo === "lugar" ? "ver" : "lugar"); setForm({ ...FORM_VACIO }); setMsg(null); }}>
            + Lugar
          </button>
          <button className={btnTab(modo === "trayecto", "bg-purple-600")}
                  onClick={() => { setModo(modo === "trayecto" ? "ver" : "trayecto");
                    setTray({ id: null, name: "", kind: "vial", width_m: 30, external_id: "", pts: [], ajustado: false, vias: [] });
                    setTrayPathAjustado(null); setMsg(null); }}>
            + Trayecto
          </button>
          <button className={btnTab(modo === "circuito", "bg-green-600")}
                  onClick={() => { setModo(modo === "circuito" ? "ver" : "circuito");
                    setCirc({ id: null, name: "", via_label: "", cerrado: false, stops: [], path: [], ajustado: false, vias: [] }); setMsg(null); }}>
            + Circuito
          </button>
          <button className={btnTab(modo === "import", "bg-amber-600")}
                  onClick={() => { setModo(modo === "import" ? "ver" : "import"); setMsg(null); }}>
            Importar
          </button>
        </div>

        {/* ── Formulario de LUGAR (crear = editar) ── */}
        {modo === "lugar" && (
          <div className="space-y-2 rounded-lg border border-blue-300 dark:border-blue-800 p-3">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {form.place_id ? "Editar lugar" : "Nuevo lugar"}
            </div>
            <div className="flex gap-1.5">
              <button className={btnTab(form.geom === "circle")}
                      onClick={() => setForm({ ...form, geom: "circle", vertices: [] })}>Círculo</button>
              <button className={btnTab(form.geom === "polygon")}
                      onClick={() => setForm({ ...form, geom: "polygon" })}>Polígono</button>
            </div>
            <div className="text-[11px] text-gray-500">
              {form.geom === "circle"
                ? (form.lat != null ? `centro: ${form.lat.toFixed(4)}, ${form.lon!.toFixed(4)}` : "clic en el mapa = centro")
                : `clic en el mapa agrega vértices (${form.vertices.length}/40)`}
              {form.geom === "polygon" && form.vertices.length > 0 && (
                <button className="ml-2 text-blue-600 hover:underline"
                        onClick={() => setForm({ ...form, vertices: form.vertices.slice(0, -1) })}>deshacer</button>
              )}
            </div>
            <input className={inp} placeholder="Nombre *" value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className={inp} value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Sin categoría (sin alertas)</option>
              {(cats ?? []).map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
            </select>
            <input className={inp} placeholder="Dirección" value={form.address}
                   onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <input className={inp} placeholder="External ID (dedup por organización)" value={form.external_id}
                   onChange={(e) => setForm({ ...form, external_id: e.target.value })} />
            {form.geom === "circle" && (
              <label className="block text-xs text-gray-500">
                Radio: <b>{form.radius_m} m</b>
                <input type="range" min={50} max={5000} step={50} value={form.radius_m} className="w-full"
                       onChange={(e) => setForm({ ...form, radius_m: Number(e.target.value) })} />
              </label>
            )}
            {/* metadata key=value */}
            <div className="space-y-1">
              <div className="text-[11px] text-gray-500">Metadata (clave = valor)</div>
              <div className="flex flex-wrap gap-1">
                {form.metadata.map((m, i) => (
                  <span key={`${m.k}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] text-gray-800 dark:text-gray-200">
                    {m.k}={m.v}
                    <button onClick={() => setForm({ ...form, metadata: form.metadata.filter((_, j) => j !== i) })}>✕</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input className={inp} placeholder="clave" value={mk} onChange={(e) => setMk(e.target.value)} />
                <input className={inp} placeholder="valor" value={mv} onChange={(e) => setMv(e.target.value)} />
                <button className="rounded-lg border border-gray-300 dark:border-gray-600 px-2 text-sm text-gray-900 dark:text-white"
                        onClick={() => { if (mk && mv) { setForm({ ...form, metadata: [...form.metadata, { k: mk, v: mv }] }); setMk(""); setMv(""); } }}>
                  +
                </button>
              </div>
            </div>
            {/* vigencia */}
            <div className="flex gap-1.5 items-center text-[11px] text-gray-500">
              <span>Vigencia</span>
              <input type="date" className={inp} value={form.active_from}
                     onChange={(e) => setForm({ ...form, active_from: e.target.value })} />
              <input type="date" className={inp} value={form.active_until}
                     onChange={(e) => setForm({ ...form, active_until: e.target.value })} />
            </div>
            <button onClick={() => void guardarLugar()} disabled={guardando}
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 disabled:opacity-50">
              {guardando ? "Guardando…" : "Guardar lugar"}
            </button>
          </div>
        )}

        {/* ── Formulario de TRAYECTO ── */}
        {modo === "trayecto" && (
          <div className="space-y-2 rounded-lg border border-purple-300 dark:border-purple-800 p-3">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {tray.id ? "Editar trayecto" : "Nuevo trayecto"} — clic en el mapa agrega puntos ({tray.pts.length})
            </div>
            <input className={inp} placeholder="Nombre *" value={tray.name}
                   onChange={(e) => setTray({ ...tray, name: e.target.value })} />
            <div className="flex gap-1.5">
              <button className={btnTab(tray.kind === "vial", "bg-purple-600")}
                      onClick={() => setTray({ ...tray, kind: "vial" })}>Vial (ruta)</button>
              <button className={btnTab(tray.kind === "interno", "bg-purple-600")}
                      onClick={() => setTray({ ...tray, kind: "interno" })}>Interno (faena)</button>
            </div>
            <label className="block text-xs text-gray-500">
              Ancho del corredor: <b>{tray.width_m} m</b>
              <input type="range" min={10} max={200} step={10} value={tray.width_m} className="w-full"
                     onChange={(e) => setTray({ ...tray, width_m: Number(e.target.value) })} />
            </label>
            <input className={inp} placeholder="External ID" value={tray.external_id}
                   onChange={(e) => setTray({ ...tray, external_id: e.target.value })} />
            <div className="flex gap-1.5">
              <button className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 text-xs py-1.5 text-gray-900 dark:text-white"
                      onClick={() => { setTray({ ...tray, pts: tray.pts.slice(0, -1), ajustado: false }); setTrayPathAjustado(null); }}>
                Deshacer punto
              </button>
              {tray.kind === "vial" && (
                <button className="flex-1 rounded-lg border border-purple-400 text-xs py-1.5 text-purple-700 dark:text-purple-300 disabled:opacity-50"
                        disabled={tray.pts.length < 2 || guardando} onClick={() => void ajustarTray()}>
                  {tray.ajustado ? "✓ Ajustado a calles" : "Ajustar a calles"}
                </button>
              )}
            </div>
            <button onClick={() => void guardarTrayecto()} disabled={guardando}
                    className="w-full rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-1.5 disabled:opacity-50">
              {guardando ? "Guardando…" : "Guardar trayecto"}
            </button>
          </div>
        )}

        {/* ── Formulario de CIRCUITO ── */}
        {modo === "circuito" && (
          <div className="space-y-2 rounded-lg border border-green-300 dark:border-green-800 p-3">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {circ.id ? "Editar circuito" : "Nuevo circuito"} — agrega paradas con «+» en la lista de lugares
            </div>
            <input className={inp} placeholder="Nombre *" value={circ.name}
                   onChange={(e) => setCirc({ ...circ, name: e.target.value })} />
            <input className={inp} placeholder="Vía (ej: vía Ruta 68)" value={circ.via_label}
                   onChange={(e) => setCirc({ ...circ, via_label: e.target.value })} />
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={circ.cerrado}
                     onChange={(e) => setCirc({ ...circ, cerrado: e.target.checked })} />
              Circuito cerrado (termina donde empieza)
            </label>
            <div className="space-y-1">
              {circ.stops.map((s, i) => (
                <div key={`${s.place_id}-${i}`} className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200">
                  <span className="w-5 text-gray-500">{i + 1}.</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-gray-500">{i === 0 ? "origen" : i === circ.stops.length - 1 ? "destino" : "parada"}</span>
                  <button className="text-rose-600" onClick={() => setCirc({ ...circ, stops: circ.stops.filter((_, j) => j !== i), ajustado: false, path: [] })}>✕</button>
                </div>
              ))}
              {!circ.stops.length && <div className="text-[11px] text-gray-500">Sin paradas aún.</div>}
            </div>
            <div className="flex gap-1.5">
              <button className="flex-1 rounded-lg border border-green-500 text-xs py-1.5 text-green-700 dark:text-green-300 disabled:opacity-50"
                      disabled={circ.stops.length < 2 || guardando} onClick={() => void ajustarCirc()}>
                {circ.ajustado ? "✓ Ajustado a calles" : "Ajustar a calles"}
              </button>
              <button onClick={() => void guardarCircuito()} disabled={guardando}
                      className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1.5 disabled:opacity-50">
                {guardando ? "Guardando…" : "Guardar circuito"}
              </button>
            </div>
          </div>
        )}

        {/* ── Importación masiva ── */}
        {modo === "import" && (
          <div className="space-y-2 rounded-lg border border-amber-300 dark:border-amber-800 p-3">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">Importación masiva de lugares</div>
            <div className="text-[11px] text-gray-500">
              Formatos: CSV (columnas name, lat, lon y opcionales radius_m, address, external_id), KML y KMZ. Máximo 500 filas.
            </div>
            <input ref={fileRef} type="file" accept=".csv,.kml,.kmz" className="text-xs text-gray-700 dark:text-gray-300"
                   onChange={(e) => { const f = e.target.files?.[0]; if (f) void onArchivo(f); }} />
            {imp.filas.length > 0 && (
              <>
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  <b>{imp.filas.length}</b> filas válidas de «{imp.filename}» ({imp.formato})
                </div>
                <div className="max-h-[120px] overflow-y-auto text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5">
                  {imp.filas.slice(0, 8).map((f, i) => (
                    <div key={i} className="truncate">· {String(f.name)} ({Number(f.lat).toFixed(3)}, {Number(f.lon).toFixed(3)})</div>
                  ))}
                  {imp.filas.length > 8 && <div>… y {imp.filas.length - 8} más</div>}
                </div>
                <div className="flex gap-1.5 items-center text-[11px] text-gray-500">
                  <span>Radio def.</span>
                  <input type="number" className={inp} value={imp.radioDef}
                         onChange={(e) => setImp({ ...imp, radioDef: Number(e.target.value) })} />
                  <select className={inp} value={imp.catDef} onChange={(e) => setImp({ ...imp, catDef: e.target.value })}>
                    <option value="">Sin categoría</option>
                    {(cats ?? []).map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                  </select>
                </div>
                <button onClick={() => void confirmarImport()} disabled={guardando}
                        className="w-full rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-1.5 disabled:opacity-50">
                  {guardando ? "Importando…" : `Confirmar importación (${imp.filas.length})`}
                </button>
              </>
            )}
            {imp.resultado && <div className="text-xs text-gray-700 dark:text-gray-300">{imp.resultado}</div>}
          </div>
        )}

        {msg && <div className="text-xs text-gray-700 dark:text-gray-300">{msg}</div>}

        <input className={inp} placeholder="Buscar por nombre, dirección o external_id…" value={busca}
               onChange={(e) => setBusca(e.target.value)} />

        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Lugares {propios && <>({lugares.length})</>}
        </div>
        <div className="space-y-1">
          {lugares.map((l) => (
            <div key={l.place_id} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: l.color ?? "#1C64F2" }} />
              <button className="min-w-0 flex-1 text-left"
                      onClick={() => l.center && mapRef.current?.flyTo({ center: [l.center[1], l.center[0]], zoom: 13 })}>
                <div className="text-sm text-gray-900 dark:text-white truncate">{l.name}</div>
                <div className="text-[11px] text-gray-500 truncate">
                  {l.category ?? "sin categoría"}{l.address ? ` · ${l.address}` : ""}</div>
              </button>
              {modo === "circuito" && (
                <button className="text-[13px] text-green-600 font-bold flex-none" title="Agregar al circuito"
                        onClick={() => agregarStop(l)}>+</button>
              )}
              <button className="text-[11px] text-blue-600 hover:underline flex-none" onClick={() => editarLugar(l)}>editar</button>
              <button className="text-[11px] text-rose-600 hover:underline flex-none" onClick={() => void borrarLugar(l)}>eliminar</button>
            </div>
          ))}
          {propios && lugares.length === 0 && (
            <div className="text-xs text-gray-500">Sin lugares{busca ? ` para «${busca}»` : " — crea el primero"}.</div>
          )}
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 pt-1">
          Trayectos {trayectos && <>({trayectos.length})</>}
        </div>
        <div className="space-y-1">
          {(trayectos ?? []).map((t) => (
            <div key={t.trayecto_id} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-none bg-purple-600" />
              <button className="min-w-0 flex-1 text-left"
                      onClick={() => t.points[0] && mapRef.current?.flyTo({ center: [t.points[0][1], t.points[0][0]], zoom: 11 })}>
                <div className="text-sm text-gray-900 dark:text-white truncate">{t.name}</div>
                <div className="text-[11px] text-gray-500">
                  {t.kind}{t.ajustado ? " · ajustado" : ""}{t.width_m ? ` · ${t.width_m} m` : ""} · {t.points.length} pts</div>
              </button>
              <button className="text-[11px] text-blue-600 hover:underline flex-none" onClick={() => editarTrayecto(t)}>editar</button>
              <button className="text-[11px] text-rose-600 hover:underline flex-none" onClick={() => void borrarTrayecto(t)}>eliminar</button>
            </div>
          ))}
          {trayectos && trayectos.length === 0 && <div className="text-xs text-gray-500">Sin trayectos.</div>}
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 pt-1">
          Circuitos {circuitos && <>({circuitos.length})</>}
        </div>
        <div className="space-y-1 pb-2">
          {(circuitos ?? []).map((c) => (
            <div key={c.route_id} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-none bg-green-600" />
              <button className="min-w-0 flex-1 text-left"
                      onClick={() => { const ctr = c.stops[0]?.center; if (ctr) mapRef.current?.flyTo({ center: [ctr[1], ctr[0]], zoom: 10 }); }}>
                <div className="text-sm text-gray-900 dark:text-white truncate">{c.name}</div>
                <div className="text-[11px] text-gray-500 truncate">
                  {c.stops.map((s) => s.name ?? "?").join(" → ")}{c.cerrado ? " (cerrado)" : ""}{c.ajustado ? " · ajustado" : ""}</div>
              </button>
              <button className="text-[11px] text-blue-600 hover:underline flex-none" onClick={() => editarCircuito(c)}>editar</button>
              <button className="text-[11px] text-rose-600 hover:underline flex-none" onClick={() => void borrarCircuito(c)}>eliminar</button>
            </div>
          ))}
          {circuitos && circuitos.length === 0 && <div className="text-xs text-gray-500">Sin circuitos.</div>}
        </div>
      </div>
    </div>
  );
}

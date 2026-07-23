"use client";

// PT4-b2 · Settings › Lugares de interés — F3 portado del laboratorio al
// patrón del app. EL MAPA ES LA PANTALLA (contrato del mockup): panel
// flotante con lista/búsqueda + formulario (crear y editar son EL MISMO
// formulario) + trayectos. Capa global siempre visible; para carriers es
// read-only y sus lugares/trayectos corren contra cuotas 600/9 (server-side).
// El tenant JAMÁS viaja desde el cliente: lo inyecta /api/atc/rpc/*.
import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import MapboxMap, { Source, Layer, Marker, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Feature, FeatureCollection, Polygon, LineString } from "geojson";
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
  category_id: number | null;
  color: string | null; center: [number, number] | null;   // [lat, lon] (lab)
  polygon: [number, number][] | null; radius_m: number | null;
  metadata: Record<string, string>; active: boolean;
};
type Trayecto = { trayecto_id: number; name: string; kind: string; points: [number, number][]; parent_name: string | null };
type Categoria = { category_id: number; name: string; color: string };
type Cuota = { usadas: number; limite: number };

// círculo geodésico aproximado (48 lados) para pintar radios en metros
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
    features.push({
      type: "Feature",
      properties: { name: l.name, color: l.color ?? (propios ? "#1C64F2" : "#6B7280"), propio: propios },
      geometry: { type: "Polygon", coordinates: [ring] } as Polygon,
    });
  }
  return { type: "FeatureCollection", features };
}

const FORM_VACIO = { place_id: null as string | null, name: "", category_id: "" as string,
  address: "", external_id: "", radius_m: 250, lat: null as number | null, lon: null as number | null };

export default function PlacesPageContent() {
  const runtimeConfig = useRuntimeConfig();
  const MAPBOX_TOKEN = runtimeConfig?.MAPBOX_API_KEY;
  const { carrierMode } = useCarrierMode();
  const mapRef = useRef<MapRef | null>(null);

  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"ver" | "lugar" | "trayecto">("ver");
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [ptsTray, setPtsTray] = useState<[number, number][]>([]); // [lon,lat]
  const [nomTray, setNomTray] = useState("");
  const [kindTray, setKindTray] = useState<"vial" | "interno">("vial");
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Propios: para carrier el proxy fuerza su org; para torre = capa global.
  const { data: propios, mutate: refP } = useSWR<Lugar[]>("/app/api/atc/rpc/fn_pt4_places", fetcher);
  const { data: globales } = useSWR<Lugar[]>(
    carrierMode ? "/app/api/atc/rpc/fn_pt4_places_global" : null, fetcher);
  const { data: trayectos, mutate: refT } = useSWR<Trayecto[]>("/app/api/atc/rpc/fn_pt4_trayectos", fetcher);
  const { data: cats } = useSWR<Categoria[]>("/app/api/atc/rpc/fn_pt4_categorias", fetcher);
  const { data: cuotas } = useSWR<{ lugares: Cuota; trayectos: Cuota }>(
    carrierMode ? "/app/api/atc/rpc/fn_pt4_quota_status" : null, fetcher);

  const lugares = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const xs = propios ?? [];
    return q ? xs.filter((l) =>
      l.name.toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q)) : xs;
  }, [propios, busca]);

  const fcPropios = useMemo(() => fcLugares(propios ?? [], true), [propios]);
  const fcGlobales = useMemo(() => fcLugares(globales ?? [], false), [globales]);
  const fcTray = useMemo<FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: (trayectos ?? []).map((t) => ({
      type: "Feature", properties: { name: t.name },
      geometry: { type: "LineString",
        coordinates: t.points.map(([la, lo]) => [lo, la]) } as LineString,
    })),
  }), [trayectos]);

  const onMapClick = (e: { lngLat: { lng: number; lat: number } }) => {
    if (modo === "lugar") setForm((f) => ({ ...f, lat: e.lngLat.lat, lon: e.lngLat.lng }));
    if (modo === "trayecto") setPtsTray((p) => [...p, [e.lngLat.lng, e.lngLat.lat]]);
  };

  const editarLugar = (l: Lugar) => {
    setModo("lugar"); setMsg(null);
    setForm({ place_id: l.place_id, name: l.name,
      category_id: l.category_id != null ? String(l.category_id) : "",
      address: l.address ?? "", external_id: "", radius_m: l.radius_m ?? 250,
      lat: l.center?.[0] ?? null, lon: l.center?.[1] ?? null });
    if (l.center) mapRef.current?.flyTo({ center: [l.center[1], l.center[0]], zoom: 13 });
  };

  const guardarLugar = async () => {
    if (!form.name || form.lat == null) { setMsg("Falta nombre o centro (clic en el mapa)."); return; }
    setGuardando(true); setMsg(null);
    const base = {
      p_name: form.name, p_category_id: form.category_id ? Number(form.category_id) : null,
      p_address: form.address || null, p_lat: form.lat, p_lon: form.lon,
      p_radius_m: form.radius_m, p_external_id: form.external_id || null, p_actor: "app-settings",
    };
    const res = form.place_id
      ? await post("fn_pt4_update_place", { p_place_id: form.place_id, ...base })
      : await post("fn_pt4_create_place", base);
    setGuardando(false);
    if (res?.ok === false) setMsg(`No guardado — ${res?.detalle ?? res?.error}`);
    else { setMsg(form.place_id ? "Lugar actualizado." : "Lugar creado y proyectado a geocercas.");
      setForm({ ...FORM_VACIO }); setModo("ver"); void refP(); }
  };

  const borrarLugar = async (l: Lugar) => {
    if (!window.confirm(`¿Eliminar «${l.name}»? Se retira su geocerca.`)) return;
    const res = await post("fn_pt4_delete_place", { p_place_id: l.place_id, p_actor: "app-settings" });
    setMsg(res?.ok === false ? `No eliminado — ${res?.detalle ?? res?.error}` : "Lugar eliminado.");
    void refP();
  };

  const guardarTrayecto = async () => {
    if (!nomTray || ptsTray.length < 2) { setMsg("Falta nombre o al menos 2 puntos."); return; }
    setGuardando(true);
    const res = await post("fn_pt4_save_trayecto", {
      p_name: nomTray, p_kind: kindTray, p_actor: "app-settings",
      p_points: ptsTray.map(([lo, la]) => [la, lo]),
    });
    setGuardando(false);
    if (res?.ok === false) setMsg(`No guardado — ${res?.detalle ?? res?.error}`);
    else { setMsg("Trayecto guardado."); setPtsTray([]); setNomTray(""); setModo("ver"); void refT(); }
  };

  const borrarTrayecto = async (t: Trayecto) => {
    if (!window.confirm(`¿Eliminar trayecto «${t.name}»?`)) return;
    const res = await post("fn_pt4_delete_trayecto", { p_route_id: t.trayecto_id, p_actor: "app-settings" });
    setMsg(res?.ok === false ? `No eliminado — ${res?.detalle ?? res?.error}` : "Trayecto eliminado.");
    void refT();
  };

  const inp = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white";

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
          {modo === "lugar" && form.lat != null && (
            <Source id="preview" type="geojson" data={{ type: "Feature", properties: {},
              geometry: { type: "Polygon", coordinates: [circuloPoly(form.lat, form.lon!, form.radius_m)] } } as Feature}>
              <Layer id="prev-fill" type="fill" paint={{ "fill-color": "#1C64F2", "fill-opacity": 0.25 }} />
              <Layer id="prev-line" type="line" paint={{ "line-color": "#1C64F2", "line-width": 2 }} />
            </Source>
          )}
          {modo === "trayecto" && ptsTray.map((p, i) => (
            <Marker key={i} longitude={p[0]} latitude={p[1]}>
              <span className="block w-2.5 h-2.5 rounded-full bg-purple-600 border-2 border-white" />
            </Marker>
          ))}
        </MapboxMap>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-gray-500">
          Falta MAPBOX_API_KEY en la configuración de runtime.
        </div>
      )}

      {/* Panel flotante — el mapa es la pantalla */}
      <div className="absolute top-4 left-4 bottom-4 w-[340px] flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-2xl p-4 overflow-y-auto">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Lugares de interés</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {carrierMode
              ? "Tus lugares y trayectos. Los oficiales de la operación se ven punteados (solo lectura)."
              : "Capa global de la operación: lugares, categorías y trayectos."}
          </p>
        </div>

        {carrierMode && cuotas && (
          <div className="flex gap-2 text-[11px]">
            <span className="rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5">
              lugares <b>{cuotas.lugares.usadas}</b>/{cuotas.lugares.limite}</span>
            <span className="rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5">
              trayectos <b>{cuotas.trayectos.usadas}</b>/{cuotas.trayectos.limite}</span>
          </div>
        )}

        <div className="flex gap-1.5">
          <button onClick={() => { setModo(modo === "lugar" ? "ver" : "lugar"); setForm({ ...FORM_VACIO }); setMsg(null); }}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${modo === "lugar"
                    ? "bg-blue-600 text-white" : "border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"}`}>
            + Nuevo lugar
          </button>
          <button onClick={() => { setModo(modo === "trayecto" ? "ver" : "trayecto"); setPtsTray([]); setMsg(null); }}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${modo === "trayecto"
                    ? "bg-purple-600 text-white" : "border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"}`}>
            + Trayecto
          </button>
        </div>

        {/* Formulario ÚNICO de lugar (crear = editar) */}
        {modo === "lugar" && (
          <div className="space-y-2 rounded-lg border border-blue-300 dark:border-blue-800 p-3">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {form.place_id ? "Editar lugar" : "Nuevo lugar"} — haz clic en el mapa para fijar el centro
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
            <label className="block text-xs text-gray-500">
              Radio: <b>{form.radius_m} m</b>
              <input type="range" min={50} max={5000} step={50} value={form.radius_m} className="w-full"
                     onChange={(e) => setForm({ ...form, radius_m: Number(e.target.value) })} />
            </label>
            <div className="text-[11px] text-gray-500">
              {form.lat != null ? `centro: ${form.lat.toFixed(4)}, ${form.lon!.toFixed(4)}` : "sin centro aún"}
            </div>
            <button onClick={() => void guardarLugar()} disabled={guardando}
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 disabled:opacity-50">
              {guardando ? "Guardando…" : "Guardar lugar"}
            </button>
          </div>
        )}

        {modo === "trayecto" && (
          <div className="space-y-2 rounded-lg border border-purple-300 dark:border-purple-800 p-3">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              Nuevo trayecto — haz clic en el mapa para agregar puntos ({ptsTray.length})
            </div>
            <input className={inp} placeholder="Nombre *" value={nomTray}
                   onChange={(e) => setNomTray(e.target.value)} />
            <div className="flex gap-1.5">
              {(["vial", "interno"] as const).map((k) => (
                <button key={k} onClick={() => setKindTray(k)}
                        className={`flex-1 rounded-lg px-2 py-1 text-xs ${kindTray === k
                          ? "bg-purple-600 text-white" : "border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"}`}>
                  {k === "vial" ? "Vial (ruta)" : "Interno (faena)"}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setPtsTray((p) => p.slice(0, -1))}
                      className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 text-xs py-1.5 text-gray-900 dark:text-white">
                Deshacer punto
              </button>
              <button onClick={() => void guardarTrayecto()} disabled={guardando}
                      className="flex-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium py-1.5 disabled:opacity-50">
                Guardar trayecto
              </button>
            </div>
          </div>
        )}

        {msg && <div className="text-xs text-gray-700 dark:text-gray-300">{msg}</div>}

        <input className={inp} placeholder="Buscar por nombre o dirección…" value={busca}
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
        <div className="space-y-1 pb-2">
          {(trayectos ?? []).map((t) => (
            <div key={t.trayecto_id} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-none bg-purple-600" />
              <button className="min-w-0 flex-1 text-left"
                      onClick={() => t.points[0] && mapRef.current?.flyTo({ center: [t.points[0][1], t.points[0][0]], zoom: 11 })}>
                <div className="text-sm text-gray-900 dark:text-white truncate">{t.name}</div>
                <div className="text-[11px] text-gray-500">{t.kind}{t.parent_name ? ` · ${t.parent_name}` : ""} · {t.points.length} puntos</div>
              </button>
              <button className="text-[11px] text-rose-600 hover:underline flex-none" onClick={() => void borrarTrayecto(t)}>eliminar</button>
            </div>
          ))}
          {trayectos && trayectos.length === 0 && (
            <div className="text-xs text-gray-500">Sin trayectos.</div>
          )}
        </div>
      </div>
    </div>
  );
}

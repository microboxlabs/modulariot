"use client";

// Gemelo Digital · Replay — port del laboratorio GOL al Coordinador.
// Datos vía API route autenticada (/app/api/gemelo/rpc/*, allowlist server-side).
// Assets del design-system en /app/gemelo/*. Mapbox token desde runtime-config.

// Replay map-first v2 — reproduce lo que sucedió, para UN servicio o
// para la FLOTA completa en servicio, con lentes what-if paramétricos:
// · Velocidad -X%: dilatación temporal de las trayectorias reales +
//   síntomas de velocidad evitados EXACTOS (speed × factor ≤ speed_limit,
//   ambos registrados por el motor de reglas en cada síntoma).
// · Geocercas por categoría (riesgo / espera / instalación / hito).
// · Pines de origen y destino (assets del design-system).
// El mapa es el canvas; todo lo demás es overlay. 2.5D opcional.
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";

const fetcher = (path: string) =>
  fetch(`/app/api/gemelo${path}`, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });
import type { LayersList, PickingInfo } from "@deck.gl/core";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { DeckProps } from "@deck.gl/core";
import { GeoJsonLayer, ScatterplotLayer, IconLayer, TextLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import MapboxMap, { useControl as useMapboxControl, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./gemelo-replay.css";
import { pointInPolygon, polygonAreaM2, bboxOf, centroidOf, hasKinks } from "../utils/geo";
import JSZip from "jszip";
import type { Feature, Polygon } from "geojson";

// token via useRuntimeConfig() dentro del componente (ver abajo)

const mapStyles: Record<string, string> = {
  streets: "mapbox://styles/mapbox/streets-v9",
  satellite: "mapbox://styles/mapbox/satellite-streets-v11",
};


type Candidato = {
  service_id: string; camion: string; ruta: string;
  ini: string; fin: string; horas: number; atraso_h: number | null;
};

type Sintoma = {
  ts: number; nombre: string; tipo?: string; icu?: number;
  speed?: number; speed_limit?: number;
  asset?: string; lng?: number; lat?: number;
};

type PuntoPlan = { lng: number; lat: number; nombre: string; codigo: string; fuente: string } | null;

type ReplayServicio = {
  service_id: string; truck: string; ruta: string;
  ini: string; fin: string; atraso_h: number | null; n_puntos: number;
  origen: PuntoPlan; destino: PuntoPlan; icu_max: number | null;
  waypoints: [number, number, number, number][];
  sintomas: Sintoma[];
  nodos: { nombre: string; entrada: number; salida: number }[];
};

type Parada = { pos: [number, number]; ini: number; fin: number; min: number };


type ReplayFlota = {
  ventana: { ini: number; fin: number };
  n_camiones: number;
  trips: {
    asset: string; service_id: string | null; eta: number | null;
    origen: string | null; destino: string | null; carrier: string | null; conductor: string | null;
    waypoints: [number, number, number][];
  }[];
  sintomas: Sintoma[];
};

type Trip = {
  id: string; asset: string; t0: number; t1: number; eta: number | null;
  origen: string | null; destino: string | null; carrier: string | null; conductor: string | null;
  path: [number, number][]; timestamps: number[]; cumKm: number[];
};

// --- Iconografía de síntomas: familia → glifo (tintado por criticidad ICU) ---
const svgUri = (path: string) =>
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><circle cx="12" cy="12" r="11" fill="white"/><g fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`);

const FAMILIAS: Record<string, { icon: string; label: string }> = {
  velocidad:   { label: "Velocidad",  icon: svgUri('<path d="M5 15a7 7 0 0 1 14 0"/><path d="M12 15l4-5"/>') },
  senal:       { label: "Señal",      icon: svgUri('<path d="M12 18h.01"/><path d="M8 14a6 6 0 0 1 8 0"/><path d="M5 11a10 10 0 0 1 14 0"/>') },
  conduccion:  { label: "Conducción", icon: svgUri('<circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/>') },
  maniobra:    { label: "Maniobra",   icon: svgUri('<path d="M6 17l4-8 4 6 4-10"/>') },
  zona:        { label: "Zona",       icon: svgUri('<path d="M12 5l8 14H4z"/><path d="M12 11v3"/><path d="M12 17h.01"/>') },
  vehiculo:    { label: "Vehículo",   icon: svgUri('<path d="M9 7h6l2 4v5h-2m-6 0H7v-5l2-4z"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/>') },
  eta:         { label: "ETA",        icon: svgUri('<path d="M6 4v16"/><path d="M6 5h11l-2.5 3.5L17 12H6"/>') },
  otro:        { label: "Otro",       icon: svgUri('<circle cx="12" cy="12" r="4"/>') },
};
const familiaDeTipo = (tipo?: string): keyof typeof FAMILIAS => {
  switch (tipo) {
    case "5": case "6": return "velocidad";
    case "9": return "senal";
    case "7": case "8": case "12": return "conduccion";
    case "24": case "33": case "34": return "maniobra";
    case "2": case "3": case "4": return "zona";
    case "21": case "23": case "26": case "32": return "vehiculo";
    case "14": return "eta";
    default: return "otro";
  }
};
// Marcador de activo: camión (glifo estándar) sobre disco — tintado por síntomas
const TRUCK_ICON = svgUri('<path d="M4 8h9v7H4z"/><path d="M13 10h4l2.5 3v2H13z"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>');
// Cara de condición del DS por criticidad máxima del viaje (ICU 1..4)
// ICU 1 Observación · 2 Comprometido · 3 Crítico · 4 Código negro
const CARA_POR_ICU: Record<number, string> = {
  1: "/app/gemelo/condiciones/en-observacion.svg",
  2: "/app/gemelo/condiciones/comprometida.svg",
  3: "/app/gemelo/condiciones/alerta-critica.svg",
  4: "/app/gemelo/condiciones/codigo-negro.svg",
};
const ICU_LABEL: Record<number, string> = {
  1: "Observación", 2: "Comprometido", 3: "Crítico", 4: "Código negro",
};
// Gota del design-system (assets/icons/pin) como máscara tintable por ICU
const GOTA_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 46" width="38" height="46"><path d="M16.5658 3.82117C17.7013 1.99485 20.2986 1.99484 21.4341 3.82117C25.6665 10.6285 33.935 24.7203 33.935 30.918C33.935 39.2476 27.2484 46 19 46C10.7516 46 4.06494 39.2476 4.06494 30.918C4.06494 24.7203 12.3334 10.6285 16.5658 3.82117Z" fill="white"/></svg>`);

// Criticidad ICU 1..4 → color (4 = código negro, vocabulario Mintral)
const ICU_RGBA: Record<number, [number, number, number, number]> = {
  1: [28, 100, 242, 230],
  2: [245, 158, 11, 235],
  3: [225, 29, 72, 240],
  4: [17, 25, 40, 255],
};

const kmEntre = (a: [number, number], b: [number, number]) => {
  const R = 6371, dLat = (b[1] - a[1]) * Math.PI / 180, dLng = (b[0] - a[0]) * Math.PI / 180;
  const q = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
};


function MapboxDeckOverlay(props: DeckProps) {
  const overlay = useMapboxControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

const fmtHM = (epoch: number) =>
  new Date(epoch * 1000).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const SPEEDS = [60, 300, 1800];
const CATEGORIAS = [
  { key: "riesgo", label: "Riesgo" },
  { key: "espera", label: "Espera" },
  { key: "instalacion", label: "Instalación" },
  { key: "hito", label: "Hito" },
  { key: "otra", label: "Otras" },
] as const;

export function ReplayMapa({ lang }: { lang: string }) {
  const runtimeConfig = useRuntimeConfig();
  const MAPBOX_TOKEN = runtimeConfig?.MAPBOX_API_KEY;
  // Fecha elegida (yyyy-mm-dd): el replay se comporta como analizador de ese
  // día completo (00:00→24:00 hora local) usando la maquinaria del microscopio
  const [fecha, setFecha] = useState("");
  const fechaVentana = useMemo(() => {
    if (!fecha) return null;
    const ini = Math.floor(new Date(`${fecha}T00:00:00`).getTime() / 1000);
    return { ini, fin: ini + 86400 };
  }, [fecha]);
  const FECHA_MIN = "2026-06-08"; // inicio del GPS en el gemelo local
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const stepFecha = (delta: number) => {
    const base = fecha || hoyISO();
    const d = new Date(`${base}T12:00:00`);
    d.setDate(d.getDate() + delta);
    const f = d.toISOString().slice(0, 10);
    if (f < FECHA_MIN || f > hoyISO()) return;
    elegirFecha(f);
  };
  const elegirFecha = (f: string) => {
    setFecha(f);
    if (f) {
      const ini = Math.floor(new Date(`${f}T00:00:00`).getTime() / 1000);
      const label = new Date(`${f}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
      setRangoLargo(0); setPlaying(false); setVerPlayer(true);
      setVentanaMicro({ ini, fin: ini + 86400, label: `Día ${label}` });
    } else {
      setVentanaMicro(null);
    }
  };

  const { data: candidatos } = useSWR<Candidato[]>(
    fechaVentana
      ? `/rpc/fn_dx_gol_replay_candidatos?p_limit=150&p_ini=${fechaVentana.ini}&p_fin=${fechaVentana.fin}`
      : "/rpc/fn_dx_gol_replay_candidatos",
    fetcher);
  const [modo, setModo] = useState<"flota" | "servicio">("flota");
  const [horasFlota, setHorasFlota] = useState(6);
  // Telescopio: rangos largos servidos por grilla precalculada (gol.grid_hora)
  const [rangoLargo, setRangoLargo] = useState<0 | 7 | 30>(0);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playLargo, setPlayLargo] = useState(false);
  // Microscopio: replay crudo de una ventana histórica (click en celda del telescopio)
  const [ventanaMicro, setVentanaMicro] = useState<{ ini: number; fin: number; label: string; asset?: string } | null>(null);
  // Drawer SuperProfile: identidad clickeada en el mapa (gota → camión)
  const [perfilSel, setPerfilSel] = useState<{ tipo: string; id: string } | null>(null);
  // Traspaso de contexto: /replay?micro_ini=..&micro_fin=.. abre el microscopio
  // (viene de la historia de un SuperProfile o de un link externo)
  const searchParams = useSearchParams();
  useEffect(() => {
    const ini = searchParams.get("micro_ini"), fin = searchParams.get("micro_fin");
    if (ini && fin) {
      setModo("flota"); setRangoLargo(0); setVerPlayer(true);
      setVentanaMicro({ ini: Number(ini), fin: Number(fin),
        label: searchParams.get("micro_label") ?? "episodio",
        asset: searchParams.get("micro_asset") ?? undefined });
    }
    // Telescopio con contexto: /replay?tele_dias=30&tele_ruta=... (desde SuperProfile)
    const dias = searchParams.get("tele_dias");
    if (dias === "7" || dias === "30") {
      setModo("flota"); setRangoLargo(Number(dias) as 7 | 30);
      const r = searchParams.get("tele_ruta"); if (r) setFRuta(r);
      const c = searchParams.get("tele_carrier"); if (c) setFCarrier(c);
      const co = searchParams.get("tele_conductor"); if (co) setFConductor(co);
      const ca = searchParams.get("tele_camion"); if (ca) setFCamion(ca);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [serviceId, setServiceId] = useState("");
  const [svc, setSvc] = useState<ReplayServicio | null>(null);
  const [cargando, setCargando] = useState(false);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [satelite, setSatelite] = useState(false);
  const [pitch3d, setPitch3d] = useState(false);
  const [seguir, setSeguir] = useState(false);
  const [cats, setCats] = useState<Record<string, boolean>>({ riesgo: true, espera: false, instalacion: false, hito: false, otra: false });
  const [reduccionPct, setReduccionPct] = useState(0);   // what-if: velocidad -X%
  const [retrasoMin, setRetrasoMin] = useState(0);        // what-if: salida +X min
  const [detencionMin, setDetencionMin] = useState(0);    // what-if: detención en ruta +X min (a mitad)
  const [verStats, setVerStats] = useState(true);
  const [verHeatmap, setVerHeatmap] = useState(false);
  const [verPlayer, setVerPlayer] = useState(false);
  const [fRuta, setFRuta] = useState("");
  const [fCarrier, setFCarrier] = useState("");
  const [fConductor, setFConductor] = useState("");
  const [fCamion, setFCamion] = useState("");
  const [fTipoSint, setFTipoSint] = useState("");
  const [fIcu, setFIcu] = useState("");
  const [area, setArea] = useState<Feature<Polygon> | null>(null);
  // Hook de desarrollo para pruebas E2E (el dibujo real usa mapbox-gl-draw)
  useEffect(() => {
    const w = window as unknown as {
      __setArea?: typeof setArea; __importKml?: typeof importarKml;
      __microscopio?: (v: { ini: number; fin: number; label: string } | null) => void;
      __perfil?: typeof setPerfilSel;
    };
    w.__setArea = setArea;
    w.__importKml = importarKml;
    w.__microscopio = (v) => { setRangoLargo(0); setVerPlayer(true); setVentanaMicro(v); };
    w.__perfil = setPerfilSel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [anSel, setAnSel] = useState("");
  const [verAnSintomas, setVerAnSintomas] = useState(false);
  const [verAnCumplimiento, setVerAnCumplimiento] = useState(false);
  const [verAnAdherencia, setVerAnAdherencia] = useState(false);
  const [verAnCircuito, setVerAnCircuito] = useState(false);
  const [circSel, setCircSel] = useState<number[]>([]);
  const [circuito, setCircuito] = useState<{
    nodos: string[]; camiones: number; assets: string[];
    por_nodo: {
      nodo: string; visitas: number; camiones: number; permanencia_p50: number | null;
      permanencia_p90: number | null; permanencia_max: number | null; horas_camion: number | null;
      detalle: { asset: string; visitas: number; permanencia_total: number | null; primera: string; ultima: string }[] | null;
    }[];
    matriz: { de: string; hacia: string; viajes: number; camiones: number; transito_p50: number | null }[];
    sintomas: { nombre: string; icu: number; casos: number }[];
  } | null>(null);
  const [circuitoCargando, setCircuitoCargando] = useState(false);
  const mapRef = useRef<MapRef | null>(null);

  const { data: geocercas } = useSWR("/rpc/fn_dx_gol_mapa_geocercas", fetcher);
  const [verTrayectos, setVerTrayectos] = useState<Record<number, boolean>>({});
  const [parTrayecto, setParTrayecto] = useState("");
  const [verZonas, setVerZonas] = useState(true);
  const { data: rutasHist } = useSWR<{ origen: string; destino: string; viajes: number }[]>(
    "/rpc/fn_dx_gol_rutas_historicas", fetcher);
  const { data: trayectos, mutate: refrescarTrayectos } = useSWR<
    { trayecto_id: number; nombre: string; origen?: string; destino?: string; muestras: number; km: number; buffer_m: number;
      linea: GeoJSON.LineString; corredor: Polygon }[]
  >("/rpc/fn_dx_gol_trayectos", fetcher);
  const { data: nodos } = useSWR<{ nodo_id: number; nombre: string }[]>(
    verAnCircuito ? "/rpc/fn_dx_gol_nodos" : null, fetcher);
  const { data: zonas, mutate: refrescarZonas } = useSWR<
    { zona_id: number; nombre: string; km2: number; geojson: Polygon }[]
  >("/rpc/fn_dx_gol_zonas", fetcher);
  const { data: flota } = useSWR<ReplayFlota>(
    modo === "flota" && ventanaMicro
      ? `/rpc/fn_dx_gol_replay_ventana?p_ini=${ventanaMicro.ini}&p_fin=${ventanaMicro.fin}${ventanaMicro.asset ? `&p_asset=${encodeURIComponent(ventanaMicro.asset)}` : ""}`
      : modo === "flota" && !rangoLargo
        ? `/rpc/fn_dx_gol_replay_flota?p_horas=${horasFlota}`
        : null,
    fetcher, { revalidateOnFocus: false }
  );

  // Opciones de filtro para rangos largos (30d de history, no dependen de trips)
  const { data: filtros30d } = useSWR<{
    rutas: string[]; carriers: string[]; conductores: string[]; camiones: string[];
    tipos: [string, string][];
  }>(modo === "flota" && rangoLargo ? "/rpc/fn_dx_gol_replay_filtros" : null,
    fetcher, { revalidateOnFocus: false });

  // Grilla del telescopio: 30d por día, 7d por hora (celda ~2.2 km)
  type FrameGrid = { t: number; celdas: [number, number, number, number, number, number][]; sintomas: number; peso: number; camiones: number };
  const { data: grid } = useSWR<{ celda: number; bucket: string; frames: FrameGrid[] }>(
    modo === "flota" && rangoLargo
      ? `/rpc/fn_dx_gol_grid_replay?p_dias=${rangoLargo}&p_bucket=${rangoLargo === 7 ? "hora" : "dia"}&p_celda=0.02`
        + (fRuta ? `&p_ruta=${encodeURIComponent(fRuta)}` : "")
        + (fCarrier ? `&p_carrier=${encodeURIComponent(fCarrier)}` : "")
        + (fConductor ? `&p_conductor=${encodeURIComponent(fConductor)}` : "")
        + (fCamion ? `&p_camion=${encodeURIComponent(fCamion)}` : "")
        + (fTipoSint ? `&p_tipo=${encodeURIComponent(fTipoSint)}` : "")
        + (fIcu ? `&p_icu=${fIcu}` : "")
      : null,
    fetcher, { revalidateOnFocus: false }
  );
  const framesGrid = useMemo(() => grid?.frames ?? [], [grid]);
  const frameGrid = framesGrid.length ? framesGrid[Math.min(frameIdx, framesGrid.length - 1)] : null;

  // Player del telescopio: avanza índice de frame a cadencia fija real
  useEffect(() => {
    if (!playLargo || !framesGrid.length) return;
    const iv = setInterval(() => {
      setFrameIdx((i) => {
        if (i + 1 >= framesGrid.length) { setPlayLargo(false); return i; }
        return i + 1;
      });
    }, rangoLargo === 7 ? 250 : 600);
    return () => clearInterval(iv);
  }, [playLargo, framesGrid.length, rangoLargo]);
  useEffect(() => { setFrameIdx(0); setPlayLargo(false); }, [rangoLargo]);

  // Identidad estable del frame para las capas
  const gridCeldas = useMemo(
    () => (frameGrid?.celdas ?? []).map((c) => ({
      pos: [c[0], c[1]] as [number, number], peso: c[2], sintomas: c[3], senales: c[4], camiones: c[5],
    })),
    [frameGrid]);

  const { data: miniPerfil } = useSWR<{
    nivel: string | null; percentil: number | null;
    estado: { vivos: number; criticos: number; sintomas_7d: number; negro_14d: number };
    patrones: { top_tipos: { nombre: string; n: number; icu_max: number }[] };
    plan: { total: number; expirados: number };
  }>(perfilSel ? `/rpc/fn_dx_gol_perfil?p_tipo=${perfilSel.tipo}&p_id=${encodeURIComponent(perfilSel.id)}` : null, fetcher);

  // Factor de dilatación temporal: -X% velocidad ⇒ misma distancia, más tiempo
  const fDur = 1 / (1 - reduccionPct / 100);

  // Normalizar ambos modos a lista de trips dilatados + síntomas
  const { trips, sintomas, rango } = useMemo((): {
    trips: Trip[]; sintomas: (Sintoma & { tDil: number; evitado: boolean; pos: [number, number] | null })[];
    rango: [number, number];
  } => {
    const shift = retrasoMin * 60;
    const parada = detencionMin * 60;
    const dilatar = (t0: number, ts: number) => t0 + (ts - t0) * fDur + shift;
    // detención en ruta: los timestamps de la segunda mitad se corren +parada
    const conParada = (tss: number[]) => {
      if (!parada || tss.length < 3) return tss;
      const mid = Math.floor(tss.length / 2);
      return tss.map((x, i) => (i >= mid ? x + parada : x));
    };
    let ts: Trip[] = [];
    let sy: Sintoma[] = [];
    const t0PorAsset = new Map<string, number>();

    if (modo === "servicio" && svc) {
      const wps = svc.waypoints;
      if (wps.length) {
        const t0 = wps[0][2];
        t0PorAsset.set(svc.truck, t0);
        const path = wps.map((w) => [w[0], w[1]] as [number, number]);
        const cumKm = path.reduce<number[]>((acc, p, i) => {
          acc.push(i === 0 ? 0 : acc[i - 1] + kmEntre(path[i - 1], p)); return acc;
        }, []);
        ts = [{
          id: svc.service_id, asset: svc.truck, t0, eta: null,
          origen: null, destino: null, carrier: null, conductor: null,
          t1: dilatar(t0, wps[wps.length - 1][2]),
          path, cumKm,
          timestamps: conParada(wps.map((w) => dilatar(t0, w[2]))),
        }];
        ts[0].t1 = ts[0].timestamps[ts[0].timestamps.length - 1];
        sy = svc.sintomas.map((s) => ({ ...s, asset: svc.truck }));
      }
    } else if (modo === "flota" && flota) {
      ts = flota.trips.filter((tr) => tr.waypoints.length >= 2).map((tr) => {
        const t0 = tr.waypoints[0][2];
        t0PorAsset.set(tr.asset, t0);
        const path = tr.waypoints.map((w) => [w[0], w[1]] as [number, number]);
        const cumKm = path.reduce<number[]>((acc, p, i) => {
          acc.push(i === 0 ? 0 : acc[i - 1] + kmEntre(path[i - 1], p)); return acc;
        }, []);
        return {
          id: tr.service_id ?? tr.asset, asset: tr.asset, t0, eta: tr.eta,
          origen: tr.origen, destino: tr.destino, carrier: tr.carrier, conductor: tr.conductor,
          t1: dilatar(t0, tr.waypoints[tr.waypoints.length - 1][2]),
          path, cumKm,
          timestamps: conParada(tr.waypoints.map((w) => dilatar(t0, w[2]))),
        };
      }).map((tr) => ({ ...tr, t1: tr.timestamps[tr.timestamps.length - 1] }));
      sy = flota.sintomas;
    }

    const rango: [number, number] = ts.length
      ? [Math.min(...ts.map((x) => x.t0)), Math.max(...ts.map((x) => x.t1))]
      : [0, 0];

    const sintomas = sy.map((s) => {
      const t0 = s.asset ? t0PorAsset.get(s.asset) : undefined;
      const tDil = t0 != null ? dilatar(t0, s.ts) : s.ts;
      const evitado =
        reduccionPct > 0 && s.speed != null && s.speed_limit != null &&
        s.speed * (1 - reduccionPct / 100) <= s.speed_limit;
      let pos: [number, number] | null = null;
      if (s.lng != null && s.lat != null) pos = [s.lng, s.lat];
      else if (modo === "servicio" && svc) {
        let best = svc.waypoints[0];
        for (const p of svc.waypoints) if (Math.abs(p[2] - s.ts) < Math.abs(best[2] - s.ts)) best = p;
        if (best) pos = [best[0], best[1]];
      }
      return { ...s, tDil, evitado, pos };
    });

    return { trips: ts, sintomas, rango };
  }, [modo, svc, flota, fDur, reduccionPct, retrasoMin, detencionMin]);

  // Filtros por elementos del servicio
  const opciones = useMemo(() => {
    // La selección vigente siempre es opción (puede venir por URL desde un
    // perfil y no existir en el catálogo — p.ej. camión de otra flota)
    const conSel = (xs: string[], val: string) => (val && !xs.includes(val) ? [val, ...xs] : xs);
    // Telescopio: las opciones vienen del history de 30 días (no hay trips crudos)
    if (rangoLargo && filtros30d) {
      return {
        rutas: conSel(filtros30d.rutas ?? [], fRuta),
        carriers: conSel(filtros30d.carriers ?? [], fCarrier),
        conductores: conSel(filtros30d.conductores ?? [], fConductor),
        camiones: conSel(filtros30d.camiones ?? [], fCamion),
      };
    }
    const u = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort();
    return {
      rutas: conSel(u(trips.map((tr) => tr.origen && tr.destino ? `${tr.origen} → ${tr.destino}` : null)), fRuta),
      carriers: conSel(u(trips.map((tr) => tr.carrier)), fCarrier),
      conductores: conSel(u(trips.map((tr) => tr.conductor)), fConductor),
      camiones: conSel(u(trips.map((tr) => tr.asset)), fCamion),
    };
  }, [trips, rangoLargo, filtros30d, fRuta, fCarrier, fConductor, fCamion]);

  // ¿Alguna posición del viaje cae dentro del área? (pre-filtro bbox + turf)
  const dentroDelArea = useMemo(() => {
    if (!area) return null;
    const [minX, minY, maxX, maxY] = bboxOf(area);
    return (path: [number, number][]) =>
      path.some(([x, y]) =>
        x >= minX && x <= maxX && y >= minY && y <= maxY &&
        pointInPolygon([x, y], area));
  }, [area]);

  // Con un análisis de circuito/red activo, el replay muestra SOLO los
  // camiones que pasaron o estuvieron en las geocercas analizadas
  const assetsCircuito = useMemo(
    () => (verAnCircuito && circuito?.assets?.length ? new Set(circuito.assets) : null),
    [verAnCircuito, circuito]);

  const tripsF = useMemo(() => {
    if (modo === "servicio") return trips;   // los filtros de flota no aplican a un viaje individual
    return trips.filter((tr) =>
      (!assetsCircuito || assetsCircuito.has(tr.asset)) &&
      (!fRuta || `${tr.origen} → ${tr.destino}` === fRuta) &&
      (!fCarrier || tr.carrier === fCarrier) &&
      (!fConductor || tr.conductor === fConductor) &&
      (!fCamion || tr.asset === fCamion) &&
      (!dentroDelArea || dentroDelArea(tr.path))
    );
  }, [modo, trips, fRuta, fCarrier, fConductor, fCamion, dentroDelArea, assetsCircuito]);

  const sintomasF = useMemo(() => {
    const assets = new Set(tripsF.map((tr) => tr.asset));
    return sintomas.filter((s) =>
      (!s.asset || assets.has(s.asset)) &&
      (!fTipoSint || s.tipo === fTipoSint) &&
      (!fIcu || String(s.icu ?? "") === fIcu) &&
      (!dentroDelArea || (s.lng != null && s.lat != null && dentroDelArea([[s.lng, s.lat]])))
    );
  }, [sintomas, tripsF, fTipoSint, fIcu, dentroDelArea]);

  // Atraso como EVENTO: se detecta al cruzar la ETA prometida sin arribo;
  // la posición es la del camión en ese instante
  const atrasos = useMemo(() => {
    return tripsF
      .filter((tr) => tr.eta != null && tr.t1 > tr.eta!)
      .map((tr) => {
        let i = 0;
        while (i < tr.timestamps.length - 1 && tr.timestamps[i + 1] <= tr.eta!) i++;
        return {
          id: tr.id, asset: tr.asset,
          ts: tr.eta!,
          pos: tr.path[i] as [number, number],
          minAtraso: Math.round((tr.t1 - tr.eta!) / 60),
        };
      });
  }, [tripsF]);

  // G4 · Adherencia al trayecto: % de puntos dentro del corredor activo y
  // DESVÍOS como eventos (primer punto fuera tras >=3 consecutivos, con momento)
  const trayectoActivo = useMemo(
    () => (trayectos ?? []).find((ty) => verTrayectos[ty.trayecto_id]) ?? null,
    [trayectos, verTrayectos]);

  const anAdherencia = useMemo(() => {
    if (!verAnAdherencia || !trayectoActivo) return null;
    const poly = { type: "Feature" as const, properties: {}, geometry: trayectoActivo.corredor };
    const [minX, minY, maxX, maxY] = bboxOf(poly);
    const dentro = ([x, y]: [number, number]) =>
      x >= minX && x <= maxX && y >= minY && y <= maxY &&
      pointInPolygon([x, y], poly);
    let candidatos = tripsF.filter((tr) =>
      (!trayectoActivo.origen || tr.origen === trayectoActivo.origen) &&
      (!trayectoActivo.destino || tr.destino === trayectoActivo.destino));
    // Sin viajes declarados de ese par O/D en la ventana: evaluar a quienes
    // efectivamente transitan el corredor (>= 20% de sus puntos dentro)
    if (candidatos.length === 0) {
      candidatos = tripsF.filter((tr) => {
        const n = tr.path.length;
        let dentroN = 0;
        for (let i = 0; i < n; i += 4) if (dentro(tr.path[i])) dentroN++;
        return dentroN >= Math.ceil(n / 4 / 5);
      });
    }
    const servicios = candidatos.map((tr) => {
      const flags = tr.path.map(dentro);
      const nIn = flags.filter(Boolean).length;
      const desvios: { pos: [number, number]; ts: number; id: string; asset: string }[] = [];
      let fuera = 0;
      for (let i = 0; i < flags.length; i++) {
        if (!flags[i]) {
          fuera++;
          if (fuera === 3) desvios.push({ pos: tr.path[i - 2], ts: tr.timestamps[i - 2], id: tr.id, asset: tr.asset });
        } else fuera = 0;
      }
      return { id: tr.id, asset: tr.asset, pct: Math.round((100 * nIn) / flags.length), desvios };
    });
    return {
      trayecto: trayectoActivo.nombre,
      servicios: servicios.sort((a, b) => a.pct - b.pct),
      eventos: servicios.flatMap((sv) => sv.desvios),
      pctProm: servicios.length ? Math.round(servicios.reduce((a, b) => a + b.pct, 0) / servicios.length) : 0,
    };
  }, [verAnAdherencia, trayectoActivo, tripsF]);

  const tiposSintoma = useMemo(() => {
    if (rangoLargo && filtros30d?.tipos) return filtros30d.tipos;
    const m = new Map<string, string>();
    for (const s of sintomas) if (s.tipo && !m.has(s.tipo)) m.set(s.tipo, s.nombre);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sintomas, rangoLargo, filtros30d]);

  // Analizador de síntomas: tipo → casos + distribución ICU (hasta t)
  const anSintomas = useMemo(() => {
    const vistos = sintomasF.filter((s) => s.tDil <= t && !s.evitado);
    const porTipo = new Map<string, { nombre: string; total: number; icu: [number, number, number, number] }>();
    for (const s of vistos) {
      const k = s.tipo ?? "?";
      if (!porTipo.has(k)) porTipo.set(k, { nombre: s.nombre, total: 0, icu: [0, 0, 0, 0] });
      const e = porTipo.get(k)!;
      e.total++;
      e.icu[Math.min(4, Math.max(1, s.icu ?? 2)) - 1]++;
    }
    return [...porTipo.entries()]
      .map(([tipo, e]) => ({ tipo, ...e }))
      .sort((a, b) => b.total - a.total);
  }, [sintomasF, t]);

  // Analizador de cumplimiento logístico: llegadas vs ETA prometida
  const anCumplimiento = useMemo(() => {
    const conEta = tripsF.filter((tr) => tr.eta != null);
    const cerrados = conEta.filter((tr) => tr.t1 <= t);
    const aTiempo = cerrados.filter((tr) => tr.t1 <= tr.eta!).length;
    // atraso DETECTADO: la ETA ya pasó (ts <= t) y el viaje no había llegado
    const atrasados = conEta.filter((tr) => tr.eta! <= t && tr.t1 > tr.eta!).length;
    const enRiesgo = conEta.filter((tr) => tr.t1 > t && tr.t1 > tr.eta! && tr.eta! > t).length;
    const peores = conEta
      .filter((tr) => tr.t1 > tr.eta!)
      .map((tr) => ({ id: tr.id, asset: tr.asset, min: Math.round((tr.t1 - tr.eta!) / 60) }))
      .sort((a, b) => b.min - a.min)
      .slice(0, 5);
    return { conEta: conEta.length, cerrados: cerrados.length, aTiempo, atrasados, enRiesgo, peores };
  }, [tripsF, t]);

  // Centroides de geocercas: ancla visual a cualquier zoom (el polígono
  // desaparece a zoom continental; el punto en píxeles no)
  const geocercasCentroides = useMemo(() => {
    if (!geocercas?.features) return [];
    return geocercas.features.map((f: GeoJSON.Feature) => ({
      pos: centroidOf(f),
      name: (f.properties as { name: string }).name,
      categoria: (f.properties as { categoria: string }).categoria,
    }));
  }, [geocercas]);

  const [t0R, t1R] = rango;

  // Impacto del what-if
  const impacto = useMemo(() => {
    if (!trips.length) return null;
    const deltas = tripsF.map((tr) => ((tr.t1 - tr.t0) - (tr.t1 - tr.t0) / fDur) / 60);
    const vel = sintomasF.filter((s) => s.speed != null && s.speed_limit != null);
    const conEta = tripsF.filter((tr) => tr.eta != null);
    const shift = retrasoMin * 60;
    const etasPerdidas = conEta.filter((tr) => tr.t1 > tr.eta! && tr.t1 - shift - ((tr.t1 - shift - tr.t0) - (tr.t1 - shift - tr.t0) / fDur) <= tr.eta!).length;
    return {
      deltaProm: deltas.reduce((a, b) => a + b, 0) / deltas.length,
      deltaMax: Math.max(...deltas),
      velTotal: vel.length,
      velEvitados: vel.filter((s) => s.evitado).length,
      conEta: conEta.length,
      etasPerdidas,
    };
  }, [tripsF, sintomasF, fDur, retrasoMin, detencionMin]);

  async function cargarServicio(id: string) {
    setCargando(true); setPlaying(false);
    try {
      const r: ReplayServicio = await fetcher(`/rpc/fn_dx_gol_replay?p_service_id=${encodeURIComponent(id)}`);
      setSvc(r);
      const first = r.waypoints[0];
      if (first) { setT(first[2]); mapRef.current?.flyTo({ center: [first[0], first[1]], zoom: 9 }); }
      setVerPlayer(true);
    } finally { setCargando(false); }
  }

  useEffect(() => { if (t < t0R || t > t1R) setT(t0R); }, [t0R, t1R, t]);

  useEffect(() => {
    if (!playing || !trips.length) return;
    let raf: number; let last = performance.now(); let lastSet = 0; let acc = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      acc += dt * SPEEDS[speedIdx];
      // actualizar el estado React a ~7 fps: suficiente para la animación,
      // sin re-renderizar toda la app 60 veces por segundo
      if (now - lastSet >= 200) {
        const delta = acc; acc = 0; lastSet = now;
        setT((prev) => {
          const next = prev + delta;
          if (next >= t1R) { setPlaying(false); return t1R; }
          return next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speedIdx, trips.length, t1R]);

  const posActual = useMemo(() => {
    if (modo !== "servicio" || !trips[0]) return null;
    const tr = trips[0];
    let i = 0;
    while (i < tr.timestamps.length - 1 && tr.timestamps[i + 1] <= t) i++;
    return tr.path[i] ?? null;
  }, [modo, trips, t]);

  useEffect(() => {
    if (seguir && posActual && mapRef.current) {
      mapRef.current.easeTo({ center: posActual, duration: 300 });
    }
  }, [posActual, seguir]);

  // Paradas reales del servicio: velocidad < 3 km/h sostenida >= 5 min
  const paradas = useMemo((): Parada[] => {
    if (modo !== "servicio" || !svc || !trips[0]) return [];
    const wps = svc.waypoints;
    const tss = trips[0].timestamps;   // ya dilatados/desplazados
    const out: Parada[] = [];
    let inicio = -1;
    for (let i = 0; i < wps.length; i++) {
      const detenido = (wps[i][3] ?? 0) < 3;
      if (detenido && inicio < 0) inicio = i;
      if ((!detenido || i === wps.length - 1) && inicio >= 0) {
        const fin = detenido ? i : i - 1;
        const dur = (tss[fin] - tss[inicio]) / 60;
        if (dur >= 5) out.push({
          pos: [wps[inicio][0], wps[inicio][1]],
          ini: tss[inicio], fin: tss[fin], min: Math.round(dur),
        });
        inicio = -1;
      }
    }
    return out;
  }, [modo, svc, trips]);


  // Buckets de refresco escalados al rango: en 24h de flota, 60s simulados
  // cambian en cada tick de 200ms y el heatmap re-agregaba la textura GPU
  // 5 veces/segundo. Tope: ~100 re-agregaciones de heatmap y ~400 de
  // marcadores por reproducción completa, sea cual sea el rango.
  const heatBucket = Math.max(60, Math.floor((t1R - t0R) / 100) || 60);
  const visBucket = Math.max(10, Math.floor((t1R - t0R) / 400) || 10);
  const tHeat = Math.floor(t / heatBucket) * heatBucket;
  const tVis = Math.floor(t / visBucket) * visBucket;

  // Identidad estable entre ticks: si estos filter() viven dentro del memo
  // de capas, cada render crea un array nuevo y deck.gl re-sube los datos
  // aunque tHeat/tVis no hayan cambiado (updateTriggers no cubre `data`)
  const heatAtrasos = useMemo(
    () => atrasos.filter((a) => a.ts <= tHeat),
    [atrasos, tHeat]);
  const heatSintomas = useMemo(
    () => sintomasF.filter((x) => x.tDil <= tHeat && x.pos && !x.evitado),
    [sintomasF, tHeat]);
  const sintVisibles = useMemo(
    () => sintomasF.filter((s) => s.tDil <= tVis && s.pos),
    [sintomasF, tVis]);

  const layers: LayersList = useMemo(() => {
    const L: LayersList = [];
    const activas = Object.entries(cats).filter(([, v]) => v).map(([k]) => k);
    if (geocercas && activas.length) {
      const feats = (geocercas.features ?? []).filter(
        (f: { properties: { categoria: string } }) => activas.includes(f.properties.categoria)
      );
      // Ancla de zoom: punto de categoría en el centroide (tamaño en píxeles)
      L.push(new ScatterplotLayer({
        id: "geocercas-centroides",
        data: geocercasCentroides.filter((c: { categoria: string }) => activas.includes(c.categoria)),
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getFillColor: (d: { categoria: string }) =>
          d.categoria === "riesgo" ? [225, 29, 72, 200] : [28, 100, 242, 180],
        getRadius: (d: { categoria: string }) => (d.categoria === "riesgo" ? 4.5 : 3.5),
        radiusUnits: "pixels",
        stroked: true, getLineColor: [255, 255, 255, 220], getLineWidth: 1, lineWidthUnits: "pixels",
        pickable: true,
      }));
      L.push(new GeoJsonLayer({
        id: "geocercas",
        data: { type: "FeatureCollection", features: feats },
        stroked: true, filled: true,
        getFillColor: (f: { properties: { categoria: string } }) =>
          f.properties.categoria === "riesgo" ? [225, 29, 72, 18] : [28, 100, 242, 14],
        getLineColor: (f: { properties: { categoria: string } }) =>
          f.properties.categoria === "riesgo" ? [225, 29, 72, 110] : [28, 100, 242, 100],
        getLineWidth: 1, lineWidthUnits: "pixels",
        pickable: true,
      }));
    }
    // Telescopio (7/30 días): calor ponderado ICU por celda + celdas con
    // síntomas pickeables. No hay trips crudos en este modo.
    if (rangoLargo && gridCeldas.length) {
      L.push(new HeatmapLayer({
        id: "grid-heat",
        data: gridCeldas,
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getWeight: (d: { peso: number; senales: number }) => d.peso > 0 ? d.peso : Math.min(1, d.senales / 500),
        radiusPixels: 40,
        aggregation: "SUM",
      }));
      L.push(new ScatterplotLayer({
        id: "grid-celdas-sintomas",
        data: gridCeldas.filter((c) => c.sintomas > 0),
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getFillColor: [225, 29, 72, 90],
        getRadius: (d: { peso: number }) => 4 + Math.min(10, Math.sqrt(d.peso)),
        radiusUnits: "pixels",
        stroked: false,
        pickable: true,
      }));
    }
    if (verHeatmap && !rangoLargo) {
      if (verAnCumplimiento && !verAnSintomas) {
        // Analizando cumplimiento: densidad de ATRASOS DETECTADOS hasta t,
        // ponderada por la magnitud del atraso (tope 8h para no saturar)
        L.push(new HeatmapLayer({
          id: "heatmap-atrasos",
          data: heatAtrasos,
          getPosition: (d: { pos: [number, number] }) => d.pos,
          getWeight: (d: { minAtraso: number }) => Math.min(480, d.minAtraso),
          radiusPixels: 45,
          aggregation: "SUM",
          updateTriggers: { getPosition: [tHeat], getWeight: [tHeat] },
        }));
      } else {
        // Densidad de SÍNTOMAS ponderada por criticidad ICU:
        // un código negro (4) pesa el doble que un comprometido (2) —
        // el calor muestra dónde se concentra la GRAVEDAD, no el ruido
        L.push(new HeatmapLayer({
          id: "heatmap-sintomas",
          data: heatSintomas,
          getPosition: (d: { pos: [number, number] }) => d.pos,
          getWeight: (d: { icu?: number }) => Math.min(4, Math.max(1, d.icu ?? 2)),
          radiusPixels: 45,
          aggregation: "SUM",
          updateTriggers: { getPosition: [tHeat], getWeight: [tHeat] },
        }));
      }
    }
    // Zonas guardadas: siempre identificables (contorno violeta + centroide en píxeles)
    if (verZonas && (zonas ?? []).length) {
      const feats = (zonas ?? []).map((z) => ({
        type: "Feature" as const, properties: { name: z.nombre, categoria: "zona" }, geometry: z.geojson,
      }));
      L.push(new GeoJsonLayer({
        id: "zonas-guardadas",
        data: { type: "FeatureCollection", features: feats },
        stroked: true, filled: true,
        getFillColor: [124, 58, 237, 18],
        getLineColor: [124, 58, 237, 180],
        getLineWidth: 1.5, lineWidthUnits: "pixels",
        pickable: true,
      }));
      L.push(new TextLayer({
        id: "zonas-etiquetas",
        data: (zonas ?? []).map((z) => ({
          pos: centroidOf({ geometry: z.geojson }),
          name: z.nombre,
        })),
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getText: (d: { name: string }) => d.name,
        getSize: 12, sizeUnits: "pixels",
        getColor: [17, 25, 40, 255],
        background: true, getBackgroundColor: [255, 255, 255, 200],
        backgroundPadding: [4, 2],
        getPixelOffset: [0, -14],
        fontFamily: "Inter, sans-serif",
      }));
      L.push(new ScatterplotLayer({
        id: "zonas-centroides",
        data: (zonas ?? []).map((z) => ({
          pos: centroidOf({ geometry: z.geojson }),
          name: z.nombre, categoria: "zona",
        })),
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getFillColor: [124, 58, 237, 210],
        getRadius: 5, radiusUnits: "pixels",
        stroked: true, getLineColor: [255, 255, 255, 220], getLineWidth: 1.5, lineWidthUnits: "pixels",
        pickable: true,
      }));
    }

    // Circuito activo: resaltar las geocercas A (azul) y B (verde)
    if (verAnCircuito && geocercas && circSel.length) {
      const nombresSel = (nodos ?? []).filter((n) => circSel.includes(n.nodo_id)).map((n) => n.nombre);
      const seleccion = (geocercas.features ?? []).filter(
        (f: { properties: { name: string } }) => nombresSel.includes(f.properties.name));
      L.push(new GeoJsonLayer({
        id: "circuito-geocercas",
        data: { type: "FeatureCollection", features: seleccion },
        stroked: true, filled: true,
        getFillColor: [14, 159, 110, 55],
        getLineColor: [17, 25, 40, 200],
        getLineWidth: 2, lineWidthUnits: "pixels",
        pickable: true,
      }));
      L.push(new TextLayer({
        id: "circuito-etiquetas",
        data: seleccion.map((f: GeoJSON.Feature) => ({
          pos: centroidOf(f),
          name: (f.properties as { name: string }).name,
        })),
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getText: (d: { name: string }) => d.name,
        getSize: 13, sizeUnits: "pixels",
        getColor: [255, 255, 255, 255],
        background: true, getBackgroundColor: [14, 159, 110, 230],
        backgroundPadding: [5, 3],
        getPixelOffset: [0, -16],
        fontFamily: "Inter, sans-serif",
      }));
    }

    // Trayectos activados: corredor (buffer tenue) + línea del trayecto típico
    for (const ty of trayectos ?? []) {
      if (!verTrayectos[ty.trayecto_id]) continue;
      L.push(new GeoJsonLayer({
        id: `trayecto-corredor-${ty.trayecto_id}`,
        data: { type: "Feature", properties: { nombre: ty.nombre }, geometry: ty.corredor },
        stroked: true, filled: true,
        getFillColor: [14, 159, 110, 25],
        getLineColor: [14, 159, 110, 120],
        getLineWidth: 1, lineWidthUnits: "pixels",
        pickable: true,
      }));
      L.push(new GeoJsonLayer({
        id: `trayecto-linea-${ty.trayecto_id}`,
        data: { type: "Feature", properties: { nombre: ty.nombre }, geometry: ty.linea },
        stroked: true, filled: false,
        getLineColor: [14, 159, 110, 220],
        getLineWidth: 2.5, lineWidthUnits: "pixels",
        pickable: true,
      }));
    }

    // Desvíos de trayecto: triángulo de zona ámbar en el punto y momento de salida
    if (verAnAdherencia && anAdherencia) {
      L.push(new IconLayer({
        id: "desvios",
        data: anAdherencia.eventos.filter((e) => e.ts <= tVis),
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getIcon: () => ({ url: FAMILIAS.zona.icon, width: 48, height: 48, mask: true }),
        getColor: [245, 158, 11, 245],
        getSize: 24, sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getPosition: [tVis] },
      }));
    }

    // Atrasos detectados: bandera ETA rosa en el punto y momento de detección
    if (verAnCumplimiento && !verHeatmap) {
      L.push(new IconLayer({
        id: "atrasos",
        data: atrasos.filter((a) => a.ts <= tVis),
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getIcon: () => ({ url: FAMILIAS.eta.icon, width: 48, height: 48, mask: true }),
        getColor: [225, 29, 72, 240],
        getSize: 24, sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getPosition: [tVis] },
      }));
    }
    if (tripsF.length) {
      // Con heatmap activo las estelas se apagan: bajo el calor son ruido
      // visual y su shader corre por frame sobre todos los segmentos de la
      // flota — es la principal carga GPU en rangos largos
      if (!verHeatmap) L.push(new TripsLayer({
        id: "trayectorias",
        data: tripsF,
        getPath: (d: Trip) => d.path,
        getTimestamps: (d: Trip) => d.timestamps,
        getColor: [28, 100, 242],
        widthMinPixels: modo === "flota" ? 2 : 4,
        capRounded: true, jointRounded: true,
        trailLength: modo === "flota" ? 1800 : 3600,
        currentTime: t,
        updateTriggers: { getTimestamps: [fDur] },
      }));
      // Síntomas: solo si el análisis activo es de síntomas (o no hay análisis);
      // en cumplimiento el mapa muestra únicamente las banderas de atraso
      const soloCumplimiento = (verAnCumplimiento || verAnAdherencia) && !verAnSintomas;
      const visibles = (verHeatmap || soloCumplimiento) ? [] : sintVisibles;
      // Gota completa pre-compuesta (public/gotas): color ICU + cara de
      // condición en registro perfecto — una sola capa
      L.push(new IconLayer({
        id: "sintomas-gota",
        data: visibles,
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getIcon: (d: { evitado: boolean; icu?: number }) => ({
          url: d.evitado ? "/app/gemelo/gotas/evitado.svg" : `/app/gemelo/gotas/icu${Math.min(4, Math.max(1, d.icu ?? 2))}.svg`,
          width: 76, height: 92, anchorY: 92,
        }),
        getSize: (d: { icu?: number }) => (d.icu === 4 ? 42 : 34),
        sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getIcon: [reduccionPct] },
      }));
    }
    if (modo === "servicio" && trips[0]) {
      const tr = trips[0];
      // Paradas ya iniciadas al instante t: anillo ámbar dimensionado por duración
      const paradasVisibles = paradas.filter((pa) => pa.ini <= t);
      L.push(new ScatterplotLayer({
        id: "paradas",
        data: paradasVisibles,
        getPosition: (d: Parada) => d.pos,
        getRadius: (d: Parada) => 8 + Math.min(14, Math.sqrt(d.min) * 2),
        radiusUnits: "pixels",
        filled: true, getFillColor: [245, 158, 11, 60],
        stroked: true, getLineColor: [245, 158, 11, 220], getLineWidth: 2, lineWidthUnits: "pixels",
        pickable: true,
      }));
      // O/D del PLAN del viaje (live_trip/geocercas), fallback GPS declarado.
      // Marcador = icono estándar del activo (camión) tintado por síntomas,
      // con la cara de condición del DS según ICU máximo del viaje.
      const nSint = svc?.sintomas.length ?? 0;
      const colorSint: [number, number, number, number] =
        nSint === 0 ? [14, 159, 110, 255] : nSint <= 3 ? [245, 158, 11, 255] : [225, 29, 72, 255];
      const cara = CARA_POR_ICU[svc?.icu_max ?? 1] ?? CARA_POR_ICU[1];
      const od = [
        { pos: svc?.origen ? [svc.origen.lng, svc.origen.lat] : tr.path[0],
          rol: "Origen", info: svc?.origen ?? null },
        { pos: svc?.destino ? [svc.destino.lng, svc.destino.lat] : tr.path[tr.path.length - 1],
          rol: "Destino", info: svc?.destino ?? null },
      ];
      L.push(new IconLayer({
        id: "od-activo",
        data: od,
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getIcon: () => ({ url: TRUCK_ICON, width: 48, height: 48, mask: true }),
        getColor: colorSint,
        getSize: 30, sizeUnits: "pixels",
        pickable: true,
      }));
      L.push(new IconLayer({
        id: "od-condicion",
        data: od,
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getIcon: () => ({ url: cara, width: 64, height: 64, mask: false }),
        getSize: 16, sizeUnits: "pixels",
        getPixelOffset: [12, -12],
        pickable: false,
      }));
      if (posActual) {
        L.push(new ScatterplotLayer({
          id: "camion",
          data: [{ pos: posActual, camion: svc?.truck, servicio: svc?.service_id }],
          getPosition: (d: { pos: [number, number] }) => d.pos,
          getFillColor: [17, 25, 40, 255],
          getRadius: 9, radiusUnits: "pixels",
          stroked: true, getLineColor: [255, 255, 255], getLineWidth: 2, lineWidthUnits: "pixels",
        }));
      }
    }
    return L;
  }, [tripsF, sintomasF, atrasos, heatAtrasos, heatSintomas, sintVisibles, rangoLargo, gridCeldas, t, modo, posActual, geocercas, geocercasCentroides, cats, verZonas, zonas, fDur, reduccionPct, verHeatmap, verAnCumplimiento, verAnSintomas, verAnAdherencia, anAdherencia, verAnCircuito, circSel, nodos, paradas, svc, trayectos, verTrayectos]);

  // Identidad por patente para tooltips (conductor/carrier/ruta desde los trips)
  const infoPorAsset = useMemo(() => {
    const m = new Map<string, { conductor?: string | null; carrier?: string | null; origen?: string | null; destino?: string | null; servicio?: string | null }>();
    for (const tr of trips) if (tr.asset) m.set(tr.asset, {
      conductor: tr.conductor, carrier: tr.carrier, origen: tr.origen, destino: tr.destino,
      servicio: tr.id,
    });
    return m;
  }, [trips]);
  const fmtFecha = (ts: number) =>
    new Date(ts * 1000).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const getTooltip = (info: PickingInfo) => {
    const g = info.object as { sintomas?: number; peso?: number; camiones?: number; senales?: number } | undefined;
    if (info.layer?.id === "grid-celdas-sintomas" && g) {
      return { text: `Celda ~2.2 km\nSíntomas: ${g.sintomas} (peso ICU ${g.peso})\nCamiones: ${g.camiones} · Señales: ${g.senales}` };
    }
    const o = info.object as {
      nombre?: string; tDil?: number; evitado?: boolean; speed?: number; speed_limit?: number;
      icon?: string; id?: string; properties?: { name?: string; categoria?: string };
    } | undefined;
    if (!o) return null;
    const dsv = o as { ts?: number; id?: string; asset?: string; minAtraso?: number };
    if (dsv.ts != null && dsv.id && dsv.minAtraso == null && !("nombre" in (o as object)))
      return { text: `Desvío del corredor · ${dsv.id} · ${dsv.asset} · ${fmtHM(dsv.ts)}` };
    const atr = o as { minAtraso?: number; ts?: number; id?: string; asset?: string };
    if (atr.minAtraso != null && atr.ts != null)
      return { text: `Atraso detectado ${fmtHM(atr.ts)} · ${atr.id} · ${atr.asset} · llegará +${atr.minAtraso} min tarde` };
    const par = o as { min?: number; ini?: number; fin?: number };
    if (par.min != null && par.ini != null)
      return { text: `Parada ${par.min} min · ${fmtHM(par.ini)} → ${fmtHM(par.fin!)}` };
    const odo = o as { rol?: string; info?: { nombre: string; codigo: string; fuente: string } | null };
    if (odo.rol)
      return { text: `${odo.rol}: ${odo.info ? `${odo.info.nombre} (${odo.info.codigo}) · fuente: plan` : "estimado por GPS"}` };
    if (o.nombre) {
      const sy = o as { icu?: number; ts?: number; asset?: string };
      const crit = sy.icu ? ` · ${ICU_LABEL[sy.icu] ?? ""}`.toUpperCase() : "";
      const extra = o.speed != null ? ` · ${o.speed} km/h (límite ${o.speed_limit})` : "";
      const cuando = sy.ts != null ? `\n${fmtFecha(sy.ts)}` : "";
      const ia = sy.asset ? infoPorAsset.get(sy.asset) : undefined;
      const quien = sy.asset
        ? `\n${sy.asset}${ia?.conductor ? ` · ${ia.conductor}` : ""}${ia?.servicio ? `\nServicio ${ia.servicio}` : ""}`
        : "";
      return { text: `${o.nombre}${crit}${extra}${o.evitado ? " · EVITADO con la reducción" : ""}${cuando}${quien}` };
    }
    // Estela de un viaje (trayectoria): identidad completa del camión
    const tr = o as { id?: string; asset?: string; conductor?: string | null; carrier?: string | null; origen?: string | null; destino?: string | null; timestamps?: number[] };
    if (tr.asset && tr.timestamps) {
      const partes = [tr.asset];
      if (tr.conductor) partes.push(tr.conductor);
      if (tr.carrier) partes.push(tr.carrier);
      const ruta = tr.origen && tr.destino ? `\n${tr.origen} → ${tr.destino}` : "";
      const servicio = tr.id ? `\nServicio ${tr.id}` : "";
      const ventana = tr.timestamps.length
        ? `\n${fmtFecha(tr.timestamps[0])} → ${fmtFecha(tr.timestamps[tr.timestamps.length - 1])}`
        : "";
      return { text: `${partes.join(" · ")}${servicio}${ruta}${ventana}` };
    }
    const cam = o as { camion?: string; servicio?: string };
    if (cam.camion) return { text: `${cam.camion} · servicio ${cam.servicio}\n${fmtFecha(t)}` };
    if (o.id) return { text: String(o.id) };
    if (o.properties?.name) return { text: `${o.properties.name} · ${o.properties.categoria}` };
    const cen = o as { name?: string; categoria?: string };
    if (cen.name && cen.categoria) return { text: `${cen.name} · ${cen.categoria}` };
    return null;
  };

  // Indicadores en vivo al instante t
  const stats = useMemo(() => {
    if (!tripsF.length) return null;
    let km = 0, activos = 0;
    for (const tr of tripsF) {
      if (t >= tr.t0) {
        let i = 0;
        while (i < tr.timestamps.length - 1 && tr.timestamps[i + 1] <= t) i++;
        km += tr.cumKm[i] ?? 0;
        if (t <= tr.t1) activos++;
      }
    }
    const vistos = sintomasF.filter((s) => s.tDil <= t);
    const porIcu = [1, 2, 3, 4].map((c) => vistos.filter((s) => (s.icu ?? 2) === c && !s.evitado).length);
    const detenidoH = paradas.reduce((acc, pa) => {
      if (t <= pa.ini) return acc;
      return acc + (Math.min(t, pa.fin) - pa.ini) / 3600;
    }, 0);
    const transcurrido = Math.max(0, (t - t0R) / 3600);
    return {
      km, activos,
      horas: transcurrido,
      movimientoH: Math.max(0, transcurrido - detenidoH),
      detenidoH,
      nParadas: paradas.filter((pa) => pa.ini <= t).length,
      sintomas: vistos.length,
      evitados: vistos.filter((s) => s.evitado).length,
      porIcu,
    };
  }, [tripsF, sintomasF, t, t0R, paradas]);

  // Selección por clic en el mapa (modo circuito): 1er toque = A, 2do = B
  const onMapClick = (info: PickingInfo) => {
    // Identidad clickeable: una gota abre el SuperProfile de su camión
    if (info.layer?.id === "sintomas-gota" && info.object) {
      const a = (info.object as { asset?: string }).asset;
      if (a) { setPerfilSel({ tipo: "camion", id: a }); return; }
    }
    // Telescopio → microscopio: click en una celda con síntomas abre el
    // replay crudo del bucket (día completo, u hora ±1h en vista semanal)
    if (rangoLargo && frameGrid && info.layer?.id === "grid-celdas-sintomas") {
      const ini = rangoLargo === 7 ? frameGrid.t - 3600 : frameGrid.t;
      const fin = rangoLargo === 7 ? frameGrid.t + 7200 : frameGrid.t + 86400;
      const label = new Date(frameGrid.t * 1000).toLocaleString("es-CL",
        rangoLargo === 7
          ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
          : { day: "2-digit", month: "2-digit" });
      setPlayLargo(false); setRangoLargo(0);
      setVentanaMicro({ ini, fin, label });
      setVerPlayer(true); setPlaying(false);
      return;
    }
    if (!verAnCircuito || !info.object) return;
    const o = info.object as { name?: string; properties?: { name?: string } };
    const nombre = o.name ?? o.properties?.name;
    if (!nombre) return;
    const nodo = (nodos ?? []).find((n) => n.nombre === nombre);
    if (!nodo) return;
    setCircSel((prev) => prev.includes(nodo.nodo_id)
      ? prev.filter((x) => x !== nodo.nodo_id)
      : [...prev, nodo.nodo_id]);
  };

  const deckProps: DeckProps = { layers, getTooltip, onClick: onMapClick };
  const viewState = { longitude: -70.9, latitude: -31.8, zoom: 6.5, pitch: pitch3d ? 50 : 0 };

  const btn = (active: boolean) =>
    ({
      padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
      border: "1px solid var(--border)",
      background: active ? "var(--blue-600)" : "var(--surface)",
      color: active ? "#fff" : "var(--foreground)",
    }) as const;
  // Selector de análisis: general = ambos temas con resultados inmediatos;
  // individual = solo su tema, reproduciendo desde el inicio
  const onAnalisis = (v: string) => {
    setAnSel(v);
    if (v === "general") {
      setVerAnAdherencia(false); setVerAnCircuito(false);
      setVerAnSintomas(true); setVerAnCumplimiento(true);
      setVerPlayer(true); setPlaying(false); setT(t1R);
    } else if (v === "sintomas") {
      setVerAnSintomas(true); setVerAnCumplimiento(false); setVerAnAdherencia(false); setVerAnCircuito(false);
      setVerPlayer(true); setT(t0R); setPlaying(true);
    } else if (v === "cumplimiento") {
      setVerAnCumplimiento(true); setVerAnSintomas(false); setVerAnAdherencia(false); setVerAnCircuito(false);
      setVerPlayer(true); setT(t0R); setPlaying(true);
    } else if (v === "adherencia") {
      setVerAnAdherencia(true); setVerAnSintomas(false); setVerAnCumplimiento(false); setVerAnCircuito(false);
      setVerPlayer(true); setT(t0R); setPlaying(true);
    } else if (v === "circuito") {
      setVerAnCircuito(true);
      setVerAnSintomas(false); setVerAnCumplimiento(false); setVerAnAdherencia(false);
    } else {
      setVerAnSintomas(false); setVerAnCumplimiento(false); setVerAnAdherencia(false); setVerAnCircuito(false); setPlaying(false);
    }
  };

  // G2: zonas persistentes
  async function analizarCircuito() {
    if (circSel.length < 2) return;
    setCircuitoCargando(true);
    try {
      const r = await fetch(`/app/api/gemelo/rpc/fn_dx_gol_circuito_red`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_nodos: circSel, p_horas: horasFlota }),
      });
      setCircuito(await r.json());
    } finally { setCircuitoCargando(false); }
  }

  // Importar zonas desde KMZ (Google Earth) o KML: unzip en el navegador,
  // parseo XML nativo, y cada Placemark-polígono se guarda como zona
  // (que a su vez se registra como nodo de circuito)
  async function importarKml(texto: string): Promise<number> {
    const dom = new DOMParser().parseFromString(texto, "text/xml");
    const placemarks = [...dom.getElementsByTagName("Placemark")];
    let importadas = 0;
    for (const pm of placemarks) {
      const nombre = pm.getElementsByTagName("name")[0]?.textContent?.trim()
        || `Zona KMZ ${new Date().toISOString().slice(11, 19)}`;
      for (const poly of pm.getElementsByTagName("Polygon")) {
        const coordsTxt = poly.getElementsByTagName("outerBoundaryIs")[0]
          ?.getElementsByTagName("coordinates")[0]?.textContent?.trim();
        if (!coordsTxt) continue;
        const ring = coordsTxt.split(/\s+/).map((c) => {
          const [lng, lat] = c.split(",").map(Number);
          return [lng, lat] as [number, number];
        }).filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
        if (ring.length < 4) continue;
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push(ring[0]);   // cerrar el anillo si el KML no lo cierra
        }
        const sufijo = importadas > 0 && placemarks.length === 1 ? ` (${importadas + 1})` : "";
        const r = await fetch(`/app/api/gemelo/rpc/fn_dx_gol_zona_guardar`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            p_nombre: nombre + sufijo,
            p_geojson: { type: "Polygon", coordinates: [ring] },
            p_categoria: "importada",
            p_notas: "Importada desde KMZ/KML",
          }),
        });
        if (r.ok) importadas++;
      }
    }
    refrescarZonas();
    return importadas;
  }

  async function importarArchivo(file: File) {
    try {
      let kml: string;
      if (file.name.toLowerCase().endsWith(".kmz")) {
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entry = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".kml"));
        if (!entry) throw new Error("el KMZ no contiene ningún .kml");
        kml = await entry.async("string");
      } else {
        kml = await file.text();
      }
      const n = await importarKml(kml);
      window.alert(n > 0 ? `${n} zona${n === 1 ? "" : "s"} importada${n === 1 ? "" : "s"}` : "No se encontraron polígonos en el archivo");
    } catch (e) {
      window.alert("Error al importar: " + (e instanceof Error ? e.message : e));
    }
  }

  async function guardarZona() {
    if (!area) return;
    const nombre = window.prompt("Nombre de la zona:");
    if (!nombre) return;
    await fetch(`/app/api/gemelo/rpc/fn_dx_gol_zona_guardar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_nombre: nombre, p_geojson: area.geometry }),
    });
    refrescarZonas();
  }
  async function borrarZona(id: number) {
    await fetch(`/app/api/gemelo/rpc/fn_dx_gol_zona_borrar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_zona_id: id }),
    });
    refrescarZonas();
  }
  async function exportarZona(id: number, nombre: string) {
    const d = await fetcher(`/rpc/fn_dx_gol_zona_export_geocerca?p_zona_id=${id}`);
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `geocerca_${nombre.replace(/\s+/g, "_")}.json`;
    a.click();
  }

  async function generarTrayecto() {
    if (!parTrayecto) { window.alert("Elegir un par origen → destino"); return; }
    const [o, d] = parTrayecto.split("|");
    try {
      const r = await fetch(`/app/api/gemelo/rpc/fn_dx_gol_trayecto_generar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_origen: o, p_destino: d }),
      });
      if (!r.ok) throw new Error(await r.text());
      refrescarTrayectos();
    } catch (e) {
      window.alert("No se pudo generar: " + (e instanceof Error ? e.message : e));
    }
  }

  const sel = {
    width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "6px 8px", fontSize: 13, color: "var(--foreground)",
  } as const;
  const chip = (active: boolean) =>
    ({ ...btn(active), padding: "4px 10px", fontSize: 12, borderRadius: 9999 }) as const;

  return (
    // altura = viewport − navbar h-16 − footer h-10 del Shell
    <div className="gemelo-replay flex flex-row-reverse h-full w-full overflow-hidden">
      {perfilSel && (
        <div className="fixed right-0 top-16 bottom-10 w-[300px] z-40 border-l overflow-y-auto p-4 space-y-3 shadow-2xl"
             style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              SuperProfile
            </div>
            <button onClick={() => setPerfilSel(null)} className="text-[13px]" style={{ color: "var(--muted)" }}>✕</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold">{perfilSel.id}</span>
            {miniPerfil?.nivel && (
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold text-white"
                style={{ background: miniPerfil.nivel === "D" ? "var(--rose-600)" : miniPerfil.nivel === "C" ? "var(--amber-500)" : miniPerfil.nivel === "B" ? "var(--blue-600)" : "var(--green-500)" }}>
                {miniPerfil.nivel}
              </span>
            )}
          </div>
          {miniPerfil ? (
            <>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                Percentil {miniPerfil.percentil ?? "—"} de su población ·{" "}
                <span style={{ color: "var(--rose-600)" }}>{miniPerfil.estado.negro_14d} negros en 14d</span>
                {" "}· {miniPerfil.estado.sintomas_7d.toLocaleString()} síntomas en 7d
              </div>
              <div className="space-y-1">
                {(miniPerfil.patrones?.top_tipos ?? []).slice(0, 3).map((tt) => (
                  <div key={tt.nombre} className="flex justify-between text-[12px]">
                    <span className="truncate">{tt.nombre}</span>
                    <span style={{ color: "var(--muted)" }}>{tt.n.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                Plan: {miniPerfil.plan.total.toLocaleString()} tratamientos,{" "}
                <span style={{ color: "var(--rose-600)" }}>{miniPerfil.plan.expirados.toLocaleString()} expirados</span>
              </div>
              <Link className="btn-primary w-full justify-center"
                    href={`/${lang}/gxc/${perfilSel.tipo}?q=${encodeURIComponent(perfilSel.id)}&ini=${Math.floor(t0R)}&fin=${Math.floor(t1R)}`}>
                Abrir SuperProfile completo →
              </Link>
              <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                El perfil se abre anclado a la ventana de esta reproducción
              </div>
            </>
          ) : (
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>Cargando perfil</div>
          )}
        </div>
      )}
      {/* Barra lateral: fuente, filtros, what-if, capas y analizadores */}
      <aside
        className="w-80 flex-none h-full overflow-y-auto border-l p-4 space-y-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="text-[13px] font-medium" style={{ color: "var(--blue-600)" }}>Torre</Link>
          <span className="badge badge-warning"><span className="dot dot-warning" />Replay</span>
        </div>

        <section className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Fuente</div>
          <div className="flex gap-1">
            <button style={btn(modo === "flota")} onClick={() => { setModo("flota"); setPlaying(false); }}>Flota</button>
            <button style={btn(modo === "servicio")} onClick={() => { setModo("servicio"); setPlaying(false); }}>Un servicio</button>
          </div>
          {/* Analizador de un día completo: fecha + navegación día a día */}
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="flex-none" style={{ color: "var(--muted)" }}>Día completo</span>
            <button
              onClick={() => stepFecha(-1)}
              disabled={!!fecha && fecha <= FECHA_MIN}
              className="flex-none rounded-lg p-1.5 disabled:opacity-30"
              style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
              title="Día anterior"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <input
              type="date"
              value={fecha}
              min={FECHA_MIN}
              max={hoyISO()}
              onChange={(e) => elegirFecha(e.target.value)}
              title="Analizar un día completo (00:00–24:00)"
              className="flex-1 min-w-0"
              style={{ ...sel, width: undefined, padding: "5px 8px", fontSize: 12,
                       borderColor: fecha ? "var(--blue-600)" : "var(--border)" }}
            />
            <button
              onClick={() => stepFecha(1)}
              disabled={!fecha || fecha >= hoyISO()}
              className="flex-none rounded-lg p-1.5 disabled:opacity-30"
              style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
              title="Día siguiente"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          {modo === "flota" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[12px] flex-wrap">
                {[1, 6, 12, 24].map((h) => (
                  <button key={h} style={chip(!rangoLargo && !ventanaMicro && horasFlota === h)}
                    onClick={() => { setRangoLargo(0); setVentanaMicro(null); setFecha(""); setHorasFlota(h); }}>{h} h</button>
                ))}
                {[7, 30].map((d) => (
                  <button key={d} style={chip(rangoLargo === d)}
                    onClick={() => { setRangoLargo(d as 7 | 30); setVentanaMicro(null); setFecha(""); setPlaying(false); }}>{d} d</button>
                ))}
                {ventanaMicro && (
                  <button style={{ ...chip(true), background: "var(--rose-600)" }}
                    onClick={() => { setVentanaMicro(null); setFecha(""); }}
                    title="Salir del microscopio">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                         className="h-3.5 w-3.5 inline -mt-px mr-1"><path d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
                    {ventanaMicro.label} ✕
                  </button>
                )}
                {!rangoLargo && <span style={{ color: "var(--muted)" }}>{tripsF.length}/{trips.length} camiones</span>}
              </div>
              {rangoLargo !== 0 && (
                <div className="space-y-1 text-[12px]">
                  <div style={{ color: "var(--muted)" }}>
                    Vista agregada por {rangoLargo === 7 ? "hora" : "día"}
                    {(fRuta || fCarrier || fConductor || fCamion)
                      ? " — filtrada: el calor muestra solo los síntomas del subconjunto"
                      : " (grilla precalculada)"} —
                    click en una celda roja abre el microscopio (replay crudo) de ese {rangoLargo === 7 ? "momento" : "día"};
                    what-if y analizadores aplican solo en el microscopio
                  </div>
                  {!framesGrid.length && <div style={{ color: "var(--muted)" }}>Cargando grilla</div>}
                </div>
              )}
            </div>
          ) : (
            <select value={serviceId} style={sel}
              onChange={(e) => { setServiceId(e.target.value); if (e.target.value) cargarServicio(e.target.value); }}>
              <option value="">Seleccionar viaje cerrado</option>
              {(candidatos ?? []).map((c) => (
                <option key={c.service_id} value={c.service_id}>{c.service_id} · {c.camion} · {c.ruta} · {c.horas} h</option>
              ))}
            </select>
          )}
          {cargando && <div className="text-[12px]" style={{ color: "var(--muted)" }}>Cargando</div>}
        </section>

        {modo === "flota" && (
          <section className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Filtros del servicio</div>
            <select value={fRuta} onChange={(e) => setFRuta(e.target.value)} style={sel}>
              <option value="">Ruta (todas)</option>
              {opciones.rutas.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={fCarrier} onChange={(e) => setFCarrier(e.target.value)} style={sel}>
              <option value="">Transportista (todos)</option>
              {opciones.carriers.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={fConductor} onChange={(e) => setFConductor(e.target.value)} style={sel}>
              <option value="">Conductor (todos)</option>
              {opciones.conductores.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={fCamion} onChange={(e) => setFCamion(e.target.value)} style={sel}>
              <option value="">Camión (todos)</option>
              {opciones.camiones.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {(fRuta || fCarrier || fConductor || fCamion) && (
              <button style={chip(false)} onClick={() => { setFRuta(""); setFCarrier(""); setFConductor(""); setFCamion(""); }}>
                Limpiar filtros
              </button>
            )}
          </section>
        )}

        <section className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Filtros de síntomas</div>
          <select value={fTipoSint} onChange={(e) => setFTipoSint(e.target.value)} style={sel}>
            <option value="">Tipo de síntoma (todos)</option>
            {tiposSintoma.map(([tipo, nombre]) => <option key={tipo} value={tipo}>{nombre}</option>)}
          </select>
          <select value={fIcu} onChange={(e) => setFIcu(e.target.value)} style={sel}>
            <option value="">Criticidad ICU (todas)</option>
            <option value="1">1 · Observación</option>
            <option value="2">2 · Comprometido</option>
            <option value="3">3 · Crítico</option>
            <option value="4">4 · Código negro</option>
          </select>
        </section>

        <details className="space-y-2">
          <summary className="text-[11px] font-semibold uppercase tracking-wide cursor-pointer select-none" style={{ color: "var(--muted)" }}>
            Herramientas de mapa · área y trayectos
          </summary>
          <div className="text-[11px] font-semibold uppercase tracking-wide pt-2" style={{ color: "var(--muted)" }}>Área de análisis</div>
          {area ? (
            <div className="flex items-center justify-between text-[12px]">
              <span className="badge badge-ok">
                <span className="dot dot-ok" />
                Área activa · {(polygonAreaM2(area) / 1e6).toFixed(1)} km²
              </span>
              <button style={chip(false)} onClick={() => setArea(null)}>Quitar</button>
            </div>
          ) : (
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              Usar la herramienta de polígono (arriba a la derecha del mapa) para acotar el análisis a un área
            </div>
          )}
          <div className="flex items-center gap-1">
            {area && (
              <button style={chip(false)} onClick={guardarZona}>Guardar como zona</button>
            )}
            <label style={{ ...chip(false), cursor: "pointer" }}>
              Importar KMZ/KML
              <input type="file" accept=".kmz,.kml" className="hidden"
                     onChange={(e) => { const f = e.target.files?.[0]; if (f) importarArchivo(f); e.target.value = ""; }} />
            </label>
          </div>
          {(zonas ?? []).length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>Zonas guardadas</div>
              {(zonas ?? []).map((z) => (
                <div key={z.zona_id} className="flex items-center justify-between text-[12px] gap-1">
                  <button
                    className="truncate text-left hover:underline flex-1"
                    style={{ color: "var(--blue-600)" }}
                    title={`Cargar ${z.nombre} (${z.km2} km²)`}
                    onClick={() => {
                      const f = { type: "Feature" as const, properties: {}, geometry: z.geojson };
                      setArea(f);
                      const [minX, minY, maxX, maxY] = bboxOf(f);
                      mapRef.current?.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, duration: 800 });
                    }}
                  >
                    {z.nombre}
                  </button>
                  <button style={chip(false)} title="Exportar como geocerca"
                          onClick={() => exportarZona(z.zona_id, z.nombre)}>Exportar</button>
                  <button style={chip(false)} title="Borrar"
                          onClick={() => borrarZona(z.zona_id)}>Borrar</button>
                </div>
              ))}
            </div>
          )}

          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Trayectos</div>
          <div className="flex items-center gap-1">
            <select value={parTrayecto} onChange={(e) => setParTrayecto(e.target.value)} style={{ ...sel, flex: 1 }}>
              <option value="">Par origen → destino (histórico)</option>
              {(rutasHist ?? []).map((r) => (
                <option key={r.origen + r.destino} value={`${r.origen}|${r.destino}`}>
                  {r.origen} → {r.destino} · {r.viajes} viajes
                </option>
              ))}
            </select>
            <button style={chip(false)} onClick={generarTrayecto} title="Trayectoria mediana de los viajes reales, simplificada">
              Generar
            </button>
          </div>
          {(trayectos ?? []).map((ty) => (
            <div key={ty.trayecto_id} className="flex items-center justify-between text-[12px] gap-1">
              <button
                style={chip(!!verTrayectos[ty.trayecto_id])}
                className="truncate flex-1 text-left"
                onClick={() => setVerTrayectos({ ...verTrayectos, [ty.trayecto_id]: !verTrayectos[ty.trayecto_id] })}
              >
                {ty.nombre} · {ty.km} km · {ty.muestras} viajes
              </button>
            </div>
          ))}

        </details>



        <section className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>What-if</div>
          {[
            { k: "Velocidad", v: reduccionPct, set: setReduccionPct, min: 0, max: 30, step: 5, fmt: (x: number) => `−${x}%`, on: "var(--blue-600)" },
            { k: "Salida", v: retrasoMin, set: setRetrasoMin, min: 0, max: 60, step: 10, fmt: (x: number) => `+${x} min`, on: "var(--amber-600)" },
            { k: "Detención en ruta", v: detencionMin, set: setDetencionMin, min: 0, max: 120, step: 15, fmt: (x: number) => `+${x} min`, on: "var(--rose-600)" },
          ].map((w) => (
            <div key={w.k} className="flex items-center gap-2 text-[13px]">
              <span className="w-28 flex-none" style={{ color: "var(--muted)" }}>{w.k}</span>
              <input type="range" min={w.min} max={w.max} step={w.step} value={w.v}
                     onChange={(e) => w.set(Number(e.target.value))} className="flex-1" />
              <span className="w-16 text-right font-semibold" style={{ color: w.v ? w.on : "var(--muted)" }}>{w.fmt(w.v)}</span>
            </div>
          ))}
          {impacto && (reduccionPct > 0 || retrasoMin > 0 || detencionMin > 0) && (
            <div className="text-[12px] space-y-0.5" style={{ color: "var(--muted)" }}>
              <div>Llegada +{Math.round(impacto.deltaProm + detencionMin)} min prom · máx +{Math.round(impacto.deltaMax + detencionMin)}</div>
              {reduccionPct > 0 && <div>Excesos de velocidad evitados: {impacto.velEvitados}/{impacto.velTotal}</div>}
              {retrasoMin > 0 && impacto.conEta > 0 && <div>ETAs prometidas perdidas: {impacto.etasPerdidas}/{impacto.conEta}</div>}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Capas del mapa</div>
          <div className="flex flex-wrap gap-1">
            <button style={chip(satelite)} onClick={() => setSatelite(!satelite)} disabled={!MAPBOX_TOKEN}>Satelital</button>
            <button style={chip(pitch3d)} onClick={() => setPitch3d(!pitch3d)}>2.5D</button>
            <button style={chip(verHeatmap)} onClick={() => setVerHeatmap(!verHeatmap)}>Heatmap</button>
            <button style={chip(verZonas)} onClick={() => setVerZonas(!verZonas)}>Zonas</button>
            <button style={chip(verStats)} onClick={() => setVerStats(!verStats)}>Indicadores</button>
            {modo === "servicio" && (
              <button style={chip(seguir)} onClick={() => setSeguir(!seguir)}>Seguir camión</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {CATEGORIAS.map((c) => (
              <button key={c.key} style={chip(cats[c.key])}
                      onClick={() => setCats({ ...cats, [c.key]: !cats[c.key] })}>{c.label}</button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Análisis</div>
          <select value={anSel} onChange={(e) => onAnalisis(e.target.value)} style={sel}>
            <option value="">Sin análisis</option>
            <option value="general">Analizador general (resultados inmediatos)</option>
            <option value="sintomas">Analizador de síntomas</option>
            <option value="cumplimiento">Analizador de cumplimiento logístico</option>
            <option value="adherencia">Analizador de adherencia al trayecto</option>
            <option value="circuito">Analizador de circuito (par de geocercas)</option>
          </select>
          {verAnSintomas && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Síntomas</div>
              {anSintomas.length === 0 && (
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>Sin síntomas hasta este instante</div>
              )}
              {anSintomas.map((a) => (
                <div key={a.tipo} className="text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{a.nombre}</span>
                    <span className="font-semibold ml-2">{a.total}</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gray-100)" }}>
                    {a.icu.map((n, i) => n > 0 && (
                      <span key={i} style={{
                        width: `${(100 * n) / a.total}%`,
                        background: ["var(--blue-600)", "var(--amber-500)", "var(--rose-600)", "var(--gray-900)"][i],
                      }} title={`ICU ${i + 1}: ${n}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          {verAnCumplimiento && (
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Cumplimiento logístico</div>
          )}
          {verAnCumplimiento && (
            <div className="text-[12px] space-y-1">
              {anCumplimiento.conEta === 0 ? (
                <div style={{ color: "var(--muted)" }}>Sin ETAs prometidas en la selección</div>
              ) : (
                <>
                  {[
                    ["Con ETA prometida", anCumplimiento.conEta, null],
                    ["Llegados a tiempo", anCumplimiento.aTiempo, "var(--green-500)"],
                    ["Llegados con atraso", anCumplimiento.atrasados, "var(--rose-600)"],
                    ["En riesgo (aún en ruta)", anCumplimiento.enRiesgo, "var(--amber-600)"],
                  ].map(([k, v, c]) => (
                    <div key={k as string} className="flex items-center justify-between">
                      <span style={{ color: "var(--muted)" }}>{k}</span>
                      <span className="font-semibold" style={c ? { color: c as string } : undefined}>{v}</span>
                    </div>
                  ))}
                  {anCumplimiento.peores.length > 0 && (
                    <div className="pt-1 border-t space-y-0.5" style={{ borderColor: "var(--border)" }}>
                      <div className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>Mayores atrasos vs ETA</div>
                      {anCumplimiento.peores.map((w) => (
                        <div key={w.id} className="flex items-center justify-between">
                          <span>{w.id} · {w.asset}</span>
                          <span className="font-semibold" style={{ color: "var(--rose-600)" }}>+{w.min} min</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {verAnCircuito && (
          <section className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Analizador de circuito / red</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              Tocar geocercas en el mapa para sumarlas (tocar de nuevo las quita) o agregarlas aquí
            </div>
            <select value="" onChange={(e) => { const id = Number(e.target.value); if (id) setCircSel((prev) => prev.includes(id) ? prev : [...prev, id]); }} style={sel}>
              <option value="">Agregar geocerca o zona</option>
              {(nodos ?? []).map((n) => <option key={n.nodo_id} value={n.nodo_id}>{n.nombre}</option>)}
            </select>
            {circSel.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {circSel.map((id) => {
                  const n = (nodos ?? []).find((x) => x.nodo_id === id);
                  return (
                    <button key={id} style={chip(true)} title="Quitar"
                            onClick={() => setCircSel(circSel.filter((x) => x !== id))}>
                      {(n?.nombre ?? id).toString().slice(0, 26)} ×
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={analizarCircuito}
              disabled={circSel.length < 2 || circuitoCargando}
              className="w-full px-4 py-2 rounded-lg text-[14px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--blue-600)" }}
            >
              {circuitoCargando ? "Analizando" : `Analizar red de ${circSel.length} geocerca${circSel.length === 1 ? "" : "s"} (${horasFlota} h)`}
            </button>
            {circuito && (
              <div className="text-[12px] space-y-1">
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--muted)" }}>Camiones en la red</span>
                  <span className="font-semibold">{circuito.camiones}</span>
                </div>
                <div className="text-[11px] font-medium pt-1" style={{ color: "var(--muted)" }}>Por geocerca</div>
                {circuito.por_nodo.map((n) => (
                  <details key={n.nodo}>
                    <summary className="cursor-pointer list-none">
                      <div className="font-medium" style={{ color: "var(--blue-600)" }}>{n.nodo}</div>
                      <div style={{ color: "var(--muted)" }}>
                        {n.camiones} camiones · {n.visitas} visitas · estadía p50 {n.permanencia_p50 ?? "—"}m / p90 {n.permanencia_p90 ?? "—"}m · {n.horas_camion ?? 0} h-camión
                      </div>
                    </summary>
                    <div className="pl-2 pt-1 space-y-0.5">
                      {(n.detalle ?? []).map((c) => (
                        <div key={c.asset} className="flex items-center justify-between gap-2">
                          <button
                            className="hover:underline"
                            style={{ color: "var(--blue-600)" }}
                            title="Ver este camión en el mapa"
                            onClick={() => { setFCamion(c.asset); setModo("flota"); }}
                          >
                            {c.asset}
                          </button>
                          <span style={{ color: "var(--muted)" }}>
                            {c.visitas} vis · {c.permanencia_total ?? 0}m · {c.primera}→{c.ultima}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
                <div className="text-[11px] font-medium pt-1" style={{ color: "var(--muted)" }}>Matriz de movimientos</div>
                {circuito.matriz.length === 0 && (
                  <div style={{ color: "var(--muted)" }}>Sin movimientos entre las geocercas en la ventana</div>
                )}
                {circuito.matriz.slice(0, 8).map((m, i) => (
                  <div key={i}>
                    <div className="font-medium">{m.de} → {m.hacia}</div>
                    <div style={{ color: "var(--muted)" }}>
                      {m.viajes} viaje{m.viajes === 1 ? "" : "s"} · {m.camiones} camión{m.camiones === 1 ? "" : "es"} · tránsito p50 {m.transito_p50 ?? "—"} min
                    </div>
                  </div>
                ))}
                {circuito.sintomas.slice(0, 4).map((sy, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="dot" style={{ background: ["var(--blue-600)","var(--amber-500)","var(--rose-600)","var(--gray-900)"][(sy.icu ?? 2) - 1] }} />
                      <span className="truncate">{sy.nombre}</span>
                    </span>
                    <span className="font-semibold">{sy.casos}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {verAnAdherencia && (
          <section className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Adherencia al trayecto</div>
            {!trayectoActivo && (
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                Activar un trayecto en la sección Trayectos para analizar la adherencia de su ruta
              </div>
            )}
            {anAdherencia && (
              <div className="text-[12px] space-y-1">
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--muted)" }}>{anAdherencia.trayecto}</span>
                  <span className="font-semibold">{anAdherencia.pctProm}% prom</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--muted)" }}>Servicios evaluados</span>
                  <span className="font-semibold">{anAdherencia.servicios.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--muted)" }}>Desvíos detectados</span>
                  <span className="font-semibold" style={{ color: anAdherencia.eventos.length ? "var(--amber-600)" : undefined }}>
                    {anAdherencia.eventos.filter((e) => e.ts <= t).length}/{anAdherencia.eventos.length}
                  </span>
                </div>
                {anAdherencia.servicios.slice(0, 6).map((sv) => (
                  <div key={sv.id} className="flex items-center justify-between">
                    <span>{sv.id} · {sv.asset}</span>
                    <span className="font-semibold"
                          style={{ color: sv.pct < 80 ? "var(--rose-600)" : sv.pct < 95 ? "var(--amber-600)" : "var(--green-500)" }}>
                      {sv.pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <button
          onClick={() => setVerPlayer(!verPlayer)}
          className="w-full px-4 py-2 rounded-lg text-[14px] font-medium"
          style={verPlayer
            ? { background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)" }
            : { background: "var(--blue-600)", color: "#fff" }}
        >
          {verPlayer ? "Ocultar reproductor" : "Activar reproductor"}
        </button>
      </aside>

      {/* Canvas: el mapa */}
      <div className="relative flex-1 h-full">
        <div className="absolute inset-0">
          {MAPBOX_TOKEN ? (
            <MapboxMap
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={viewState}
              pitch={pitch3d ? 50 : 0}
              mapStyle={satelite ? mapStyles.satellite : mapStyles.streets}
              attributionControl={false}
            >
              <MapboxDeckOverlay {...deckProps} />
            </MapboxMap>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              Cargando configuración del mapa…
            </div>
          )}
        </div>

        {verStats && stats && (
          <div className="absolute left-4 top-4 card px-4 py-3 w-56 space-y-2 text-[13px]">
            <div className="font-semibold text-[13px]">Indicadores del replay</div>
            {[
              ["Km recorridos", `${Math.round(stats.km).toLocaleString("es-CL")} km`],
              ["Vehículos activos", String(stats.activos)],
              ["Tiempo transcurrido", `${stats.horas.toFixed(1)} h`],
              ...(modo === "servicio" ? [
                ["En movimiento", `${stats.movimientoH.toFixed(1)} h`],
                ["Detenido", `${stats.detenidoH.toFixed(1)} h · ${stats.nParadas} paradas`],
              ] : []),
              ["Síntomas", `${stats.sintomas}${stats.evitados ? ` (−${stats.evitados} evitados)` : ""}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
            <div className="pt-1 border-t space-y-1" style={{ borderColor: "var(--border)" }}>
              <div className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>Por criticidad</div>
              {[
                ["Observación", stats.porIcu[0], "var(--blue-600)"],
                ["Comprometido", stats.porIcu[1], "var(--amber-500)"],
                ["Crítico", stats.porIcu[2], "var(--rose-600)"],
                ["Código negro", stats.porIcu[3], "var(--gray-900)"],
              ].map(([k, v, c]) => (
                <div key={k as string} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="dot" style={{ background: c as string }} />
                    <span style={{ color: "var(--muted)" }}>{k}</span>
                  </span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!verPlayer && tripsF.length > 0 && !rangoLargo && (
          <button
            onClick={() => setVerPlayer(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg text-[14px] font-medium text-white shadow-lg"
            style={{ background: "var(--blue-600)" }}
          >
            Mostrar reproductor
          </button>
        )}
        {/* Reproductor del telescopio: mismo lugar que el reproductor crudo
            (barra inferior del mapa) — el operador lo busca siempre ahí */}
        {rangoLargo !== 0 && framesGrid.length > 0 && frameGrid && (
          <div className="absolute bottom-4 left-4 right-4 card px-5 py-3 space-y-1">
            <div className="flex items-center justify-between text-[13px] flex-wrap gap-2">
              <div className="font-semibold">
                Telescopio · {rangoLargo} días por {rangoLargo === 7 ? "hora" : "día"}
                {(fRuta || fCarrier || fConductor || fCamion) && (
                  <span className="badge badge-warning ml-2">filtrado</span>
                )}
              </div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                {new Date(frameGrid.t * 1000).toLocaleString("es-CL",
                  rangoLargo === 7
                    ? { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
                    : { weekday: "long", day: "2-digit", month: "2-digit" })}
                {" · "}{Number(frameGrid.sintomas).toLocaleString()} síntomas · peso {Math.round(Number(frameGrid.peso)).toLocaleString()} · {frameGrid.camiones} camiones
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button style={btn(playLargo)} onClick={() => {
                if (frameIdx >= framesGrid.length - 1) setFrameIdx(0);
                setPlayLargo(!playLargo);
              }}>
                {playLargo ? "Pausa" : "Reproducir"}
              </button>
              <input type="range" min={0} max={framesGrid.length - 1} value={frameIdx}
                onChange={(e) => { setPlayLargo(false); setFrameIdx(Number(e.target.value)); }}
                className="flex-1" />
              <span className="text-[12px] flex-none" style={{ color: "var(--muted)" }}>
                {frameIdx + 1}/{framesGrid.length}
              </span>
            </div>
          </div>
        )}
        {verPlayer && tripsF.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 card px-5 py-3 space-y-2">
            <div className="flex items-center justify-between text-[13px] flex-wrap gap-2">
              <div className="font-semibold">
                {modo === "flota"
                  ? `${assetsCircuito ? "Red de geocercas" : "Flota en servicio"} · ${tripsF.length} camiones`
                  : `${svc?.service_id} · ${svc?.truck} · ${svc?.ruta}`}
                {(reduccionPct > 0 || retrasoMin > 0 || detencionMin > 0) && (
                  <span className="badge badge-warning ml-2">Simulación what-if activa</span>
                )}
              </div>
              <div style={{ color: "var(--muted)" }}>
                {fmtHM(t)} · síntomas {sintomasF.filter((x) => x.tDil <= t).length}/{sintomasF.length}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button style={btn(playing)} onClick={() => setPlaying(!playing)}>
                {playing ? "Pausa" : "Reproducir"}
              </button>
              <button style={btn(false)} onClick={() => setSpeedIdx((speedIdx + 1) % SPEEDS.length)}>
                ×{SPEEDS[speedIdx] / 60} min/s
              </button>
              <input type="range" min={t0R} max={t1R} step={30} value={t}
                     onChange={(e) => setT(Number(e.target.value))} className="flex-1" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

// Capacity Desk v2 (feedback Erick 2026-07-24: la v1 hablaba el idioma
// del MODELO, no del transportista). Rediseño por personas:
//   · El transportista básico lee FRASES: "Hoy", "¿Puedes tomar un
//     servicio?", "Sí puedes / Podrías si… / Hoy no, porque…".
//   · El versado encuentra la profundidad PLEGADA: agenda completa
//     (Gantt) y el detalle de cumplimiento, colapsados.
// Regla del doc rector: cada pantalla alrededor de una necesidad y una
// ventana; centro de control, no formulario. Backend intacto (C0–C3).
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { TextInput } from "flowbite-react";
import {
  HiOutlineCalendarDays, HiOutlineBookmark, HiCheckCircle,
  HiOutlineWrenchScrewdriver, HiOutlineChevronDown, HiOutlineChevronUp,
  HiOutlineTruck, HiOutlineSun, HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import type { AmsTruck, AmsDriver } from "@/features/ams/ficha-ams";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});
const post = async (fn: string, body: Record<string, unknown>) => {
  const r = await fetch(`/app/api/ams/rpc/${fn}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};

type Compromiso = { commitment_id: number; kind: string; ini: number; fin: number; ref: string | null };
type Unidad = {
  veredicto: string; confianza: number; dupla_vigente: boolean;
  camion: { id: string; patente: string; tipo: string | null };
  conductor: { id: string; nombre: string; licencia: string | null };
  conductor2?: { id: string; nombre: string; licencia: string | null } | null;
  remolque?: { id: string; patente: string } | null;
  causas: string[]; condiciones: string[]; acciones_recuperan: string[];
};
type Arquetipo = {
  archetype_id: number; nombre: string; descripcion: string | null;
  n_conductores: number; remolque: string;
};
type UnidadReservada = {
  unit_id: string; estado: string; ini: number; fin: number;
  expira_at: number | null;
  miembros: { rol: string; etiqueta: string | null }[];
};
type Confiabilidad = {
  cerradas: number; estabilidad: number | null; puntualidad: number | null;
  caidas: { expiradas: number; liberadas: number; rebotes: number };
  ultimas_cerradas: { unit_id: string; service_code: string | null; ini: number;
    resultado: { estable: boolean; puntual: boolean | null;
      sustituciones: { rol: string; prometido: string; ejecuto: string }[] } }[];
};

const KIND_COLOR: Record<string, string> = {
  SERVICIO: "#1C64F2", MANTENCION: "#F1B300", RESERVA: "#7E3AF2",
  BLOQUEO: "#111928", INDISPONIBILIDAD: "#E11D48",
};
const KIND_HUMANO: Record<string, string> = {
  SERVICIO: "viaje", MANTENCION: "mantención", RESERVA: "reserva",
  BLOQUEO: "bloqueo", INDISPONIBILIDAD: "no disponible",
};

const btnPri = "rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-50";
const btnSec = "rounded-lg border border-gray-300 dark:border-gray-600 text-sm px-3 py-1.5 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700";
const chip = (activo: boolean) =>
  `rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${activo
    ? "bg-blue-600 text-white border-blue-600"
    : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400"}`;

const fmtHora = (e: number) =>
  new Date(e * 1000).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
const fmtDia = (e: number) =>
  new Date(e * 1000).toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "2-digit" });

type Lugar = { place_id: string; name: string; center: [number, number] | null };

// distancia haversine en km (suficiente para "a cuántos km del origen")
function kmEntre(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const hace = (ts: number) => {
  const m = Math.round((Date.now() / 1000 - ts) / 60);
  if (m < 60) return `hace ${m} min`;
  if (m < 60 * 24) return `hace ${Math.round(m / 60)} h`;
  const d = Math.round(m / 1440);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
};

// franja horaria en lenguaje de operación
const FRANJAS = [
  { id: "manana", l: "Mañana (08–14)", ini: "08:00", fin: "14:00" },
  { id: "tarde", l: "Tarde (14–20)", ini: "14:00", fin: "20:00" },
  { id: "dia", l: "Día completo (08–18)", ini: "08:00", fin: "18:00" },
] as const;

export function CapacityDesk() {
  const { carrierMode } = useCarrierMode();
  const { data: trucks } = useSWR<AmsTruck[]>("/app/api/ams/rpc/fn_ams_trucks", fetcher);
  const { data: drivers } = useSWR<AmsDriver[]>("/app/api/ams/rpc/fn_ams_drivers", fetcher);
  const { data: unidades, mutate: mutUnidades } = useSWR<UnidadReservada[]>(
    "/app/api/ams/rpc/fn_cap_units", fetcher);
  const { data: arquetipos } = useSWR<Arquetipo[]>(
    "/app/api/ams/rpc/fn_cap_archetypes", fetcher);
  const { data: confiabilidad, mutate: mutConf } = useSWR<Confiabilidad>(
    "/app/api/ams/rpc/fn_cap_reliability", fetcher);
  const { data: lugares } = useSWR<Lugar[]>(
    "/app/api/atc/rpc/fn_pt4_places_global", fetcher);
  const runtimeConfig = useRuntimeConfig();
  const mapboxToken: string | undefined = runtimeConfig?.MAPBOX_API_KEY;

  // ── diálogo: ¿cuándo? ¿qué tipo? ──
  const hoyStr = new Date().toISOString().slice(0, 10);
  const man = new Date(); man.setDate(man.getDate() + 1);
  const mananaStr = man.toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(mananaStr);
  const [fechaLibre, setFechaLibre] = useState(false);
  const [franja, setFranja] = useState<string>("dia");
  const [origenId, setOrigenId] = useState("");
  // origen escrito a mano (geocoding directo Mapbox): {nombre, center[lat,lon]}
  const [origenLibre, setOrigenLibre] = useState<Lugar | null>(null);
  const [arq, setArq] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Unidad[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reservando, setReservando] = useState<string | null>(null);
  const [sync, setSync] = useState(false);
  const [verNo, setVerNo] = useState(false);
  const [verAgenda, setVerAgenda] = useState(true);
  const [verCumplimiento, setVerCumplimiento] = useState(false);

  const fr = FRANJAS.find((f) => f.id === franja) ?? FRANJAS[2];
  const origen: Lugar | null = origenLibre
    ?? (lugares ?? []).find((l) => l.place_id === origenId) ?? null;

  const buscar = async (arqId: number | null) => {
    setArq(arqId); setBuscando(true); setMsg(null); setResultado(null);
    const { data } = await post("fn_capacity_match", {
      p_ini: new Date(`${fecha}T${fr.ini}`).toISOString(),
      p_fin: new Date(`${fecha}T${fr.fin}`).toISOString(),
      p_archetype_id: arqId,
    });
    setBuscando(false);
    if (!data?.ok) { setMsg("No pudimos calcular — intenta de nuevo"); return; }
    setResultado(data.unidades ?? []);
  };

  const reservar = async (u: Unidad) => {
    const key = u.camion.id + u.conductor.id;
    setReservando(key); setMsg(null);
    const { data } = await post("fn_cap_reserve", {
      p_truck_id: u.camion.id,
      p_driver_ids: [u.conductor.id, ...(u.conductor2 ? [u.conductor2.id] : [])],
      p_trailer_id: u.remolque?.id ?? null,
      p_ini: new Date(`${fecha}T${fr.ini}`).toISOString(),
      p_fin: new Date(`${fecha}T${fr.fin}`).toISOString(),
      p_ttl_minutes: 30,
      p_necesidad: { fecha, franja: fr.l, arquetipo: arq },
      p_snapshot: u as unknown as Record<string, unknown>,
      p_actor: "capacity-desk",
    });
    setReservando(null);
    if (!data?.ok) {
      setMsg(data?.error === "conflicto"
        ? "Ese equipo quedó ocupado hace un momento — vuelve a consultar"
        : "No se pudo apartar");
      return;
    }
    void mutUnidades(); void buscar(arq);
  };

  const comprometer = async (unitId: string) => {
    const sc = window.prompt("¿Número de servicio? (puedes dejarlo vacío)") ?? undefined;
    await post("fn_cap_commit", { p_unit_id: unitId,
      p_service_code: sc || null, p_actor: "capacity-desk" });
    void mutUnidades(); void mutConf();
  };
  const liberar = async (unitId: string, estado: string) => {
    const q = estado === "COMPROMETIDA"
      ? "Este equipo está CONFIRMADO. ¿Soltarlo igual? (queda registrado)"
      : "¿Soltar este equipo apartado?";
    if (!window.confirm(q)) return;
    await post("fn_cap_release", { p_unit_id: unitId, p_actor: "capacity-desk" });
    void mutUnidades(); void mutConf();
  };
  const sincronizar = async () => {
    setSync(true);
    await post("fn_cap_refresh_agenda", {});
    await post("fn_cap_maintain", {});
    await post("fn_cap_close_units", {});
    setSync(false);
    window.location.reload();
  };

  // ── "HOY": frases derivadas, cero mantención ──
  const recursos = useMemo(() => [
    ...(trucks ?? []).map((t) => ({ tipo: "TRUCK" as const, id: t.id, etiqueta: t.license_plate })),
    ...(drivers ?? []).map((d) => ({ tipo: "DRIVER" as const, id: d.id, etiqueta: d.full_name })),
  ], [trucks, drivers]);

  // pérdida futura de capacidad: papeles por vencer / vencidos / faltantes
  const alertasDocs = useMemo(() => {
    const out: string[] = [];
    for (const t of trucks ?? []) {
      for (const d of t.acreditacion.documentos.docs) {
        if (d.estado === "urgente" || d.estado === "vencido") {
          out.push(`${t.license_plate}: ${d.label ?? d.doc_type} ${d.estado === "vencido" ? "VENCIDO" : `vence ${d.valid_until?.slice(0, 10)}`}`);
        }
      }
      for (const f of t.acreditacion.documentos.faltantes) {
        out.push(`${t.license_plate}: falta ${f.label}`);
      }
    }
    for (const dr of drivers ?? []) {
      for (const d of dr.acreditacion.documentos.docs) {
        if (d.estado === "urgente" || d.estado === "vencido") {
          out.push(`${dr.full_name.split(" ")[0]}: ${d.label ?? d.doc_type} ${d.estado === "vencido" ? "VENCIDO" : `vence ${d.valid_until?.slice(0, 10)}`}`);
        }
      }
    }
    return out;
  }, [trucks, drivers]);

  const vivas = unidades ?? [];
  const ahora = Date.now() / 1000;

  return (
    <div className="h-full overflow-y-auto w-full">
    <div className="flex flex-col gap-4 p-4 xl:px-8 w-full pb-10">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Capacidad</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Qué puedes comprometer, con qué equipo, y qué estás por perder.
          </p>
        </div>
        {!carrierMode && (
          <button className={btnSec} disabled={sync} onClick={() => void sincronizar()}>
            {sync ? "Actualizando…" : "Actualizar desde la operación"}
          </button>
        )}
      </div>

      {/* ════ 1 · HOY — el estado en frases ════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-start gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex-none">
            <HiOutlineTruck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </span>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {(trucks ?? []).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              camiones y {(drivers ?? []).length} conductores en tu flota
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-start gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex-none">
            <HiOutlineBookmark className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </span>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{vivas.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {vivas.length === 1 ? "equipo apartado o confirmado" : "equipos apartados o confirmados"}
            </div>
          </div>
        </div>

        <div className={`rounded-xl border p-4 flex items-start gap-3 ${alertasDocs.length
          ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/15"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
          <span className={`flex items-center justify-center w-10 h-10 rounded-lg flex-none ${alertasDocs.length
            ? "bg-amber-100 dark:bg-amber-900/30" : "bg-green-50 dark:bg-green-900/20"}`}>
            {alertasDocs.length
              ? <HiOutlineExclamationTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              : <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {alertasDocs.length
                ? `Estás por perder capacidad (${alertasDocs.length})`
                : "Papeles al día"}
            </div>
            {alertasDocs.slice(0, 2).map((a, i) => (
              <div key={i} className="text-xs text-gray-600 dark:text-gray-300 truncate">{a}</div>))}
            {alertasDocs.length > 2 && (
              <div className="text-xs text-gray-400">y {alertasDocs.length - 2} más…</div>)}
          </div>
        </div>
      </div>

      {/* ════ 2 · AGENDA DE LA FLOTA — el calendario manda (feedback Erick) ════ */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
                onClick={() => setVerAgenda(!verAgenda)}>
          <HiOutlineCalendarDays className="w-5 h-5 text-gray-500 flex-none" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
            Agenda completa de la flota (7 días)
          </span>
          {verAgenda ? <HiOutlineChevronUp className="w-4 h-4 text-gray-400" />
                     : <HiOutlineChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {verAgenda && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 pb-1">
              <div className="w-40 flex-none" />
              <div className="flex-1 grid grid-cols-7 text-[10px] uppercase tracking-wide text-gray-400">
                {[...Array(7)].map((_, i) => {
                  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
                  return <span key={i}>{d.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit" })}</span>;
                })}
              </div>
            </div>
            {recursos.map((r) => (
              <FilaAgenda key={r.id} {...r} />
            ))}
            <div className="flex items-center gap-3 pt-2 text-[11px] text-gray-500">
              {Object.entries(KIND_COLOR).map(([k, c]) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
                  {KIND_HUMANO[k]}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>


      {/* ════ 2 · ¿PUEDES TOMAR UN SERVICIO? — diálogo, no formulario ════ */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          ¿Puedes tomar un servicio?
        </h2>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 w-16">¿Cuándo?</span>
          <button className={chip(fecha === hoyStr && !fechaLibre)}
                  onClick={() => { setFecha(hoyStr); setFechaLibre(false); }}>Hoy</button>
          <button className={chip(fecha === mananaStr && !fechaLibre)}
                  onClick={() => { setFecha(mananaStr); setFechaLibre(false); }}>Mañana</button>
          <button className={chip(fechaLibre)} onClick={() => setFechaLibre(true)}>Otro día…</button>
          {fechaLibre && (
            <TextInput sizing="sm" type="date" value={fecha}
                       onChange={(e) => setFecha(e.target.value)} />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 w-16">¿Horario?</span>
          {FRANJAS.map((f) => (
            <button key={f.id} className={chip(franja === f.id)}
                    onClick={() => setFranja(f.id)}>{f.l}</button>
          ))}
        </div>

        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm text-gray-500 w-16 pt-2">¿Desde dónde?</span>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
            <select className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white max-w-xs"
                    value={origenLibre ? "" : origenId}
                    onChange={(e) => { setOrigenLibre(null); setOrigenId(e.target.value); }}>
              <option value="">Da lo mismo</option>
              <optgroup label="Tus lugares">
                {(lugares ?? []).filter((l) => l.center).map((l) => (
                  <option key={l.place_id} value={l.place_id}>{l.name}</option>
                ))}
              </optgroup>
            </select>
            <BuscadorDireccion token={mapboxToken} elegido={origenLibre}
              onElegir={(lug) => { setOrigenId(""); setOrigenLibre(lug); }} />
          </div>
        </div>

        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm text-gray-500 w-16 pt-2">¿Qué tipo?</span>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {(arquetipos ?? []).map((a) => (
              <button key={a.archetype_id}
                onClick={() => void buscar(a.archetype_id)}
                className={`rounded-lg border p-3 text-left transition-colors ${arq === a.archetype_id
                  ? "border-blue-500 ring-1 ring-blue-500"
                  : "border-gray-200 dark:border-gray-700 hover:border-blue-400"}`}>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{a.nombre}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {a.n_conductores === 2 ? "2 conductores" : "1 conductor"}
                  {a.remolque === "obligatorio" && " · con remolque"}
                </div>
              </button>
            ))}
            <button onClick={() => void buscar(null)}
              className={`rounded-lg border p-3 text-left transition-colors ${arq === null && resultado
                ? "border-blue-500 ring-1 ring-blue-500"
                : "border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400"}`}>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Cualquier servicio</div>
              <div className="text-xs text-gray-500 mt-0.5">sin requisitos especiales</div>
            </button>
          </div>
        </div>

        {buscando && <div className="text-sm text-gray-500">Revisando tu flota…</div>}
        {msg && <div className="text-sm text-red-600 dark:text-red-400">{msg}</div>}

        {resultado && !buscando && (() => {
          const si = resultado.filter((u) => u.veredicto === "DISPONIBLE" || u.veredicto === "CON_CONDICION");
          const casi = resultado.filter((u) => u.veredicto === "RECUPERABLE");
          const no = resultado.filter((u) => u.veredicto === "NO_DISPONIBLE");
          return (
            <div className="flex flex-col gap-3 pt-1 border-t border-gray-100 dark:border-gray-700">
              {/* ✅ SÍ PUEDES */}
              {si.length ? (
                <div>
                  <div className="text-sm font-semibold text-green-700 dark:text-green-400 pb-2">
                    ✅ Sí puedes — {fmtDia(new Date(`${fecha}T12:00`).getTime() / 1000)}, {fr.l.toLowerCase()}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {si.map((u) => {
                      const key = u.camion.id + u.conductor.id;
                      return (
                        <div key={key} className="rounded-lg border-2 border-green-200 dark:border-green-900 p-3 flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-semibold text-gray-900 dark:text-white">
                              {u.camion.patente}
                              <span className="font-normal text-gray-500"> con </span>
                              {u.conductor.nombre.split(" ").slice(0, 2).join(" ")}
                              {u.conductor2 && <> y {u.conductor2.nombre.split(" ").slice(0, 2).join(" ")}</>}
                              {u.remolque && <span className="text-gray-500 font-normal"> + {u.remolque.patente}</span>}
                            </div>
                            {u.condiciones.map((c, i) => (
                              <div key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
                                solo si: {c}</div>))}
                            {u.dupla_vigente && (
                              <div className="text-xs text-gray-500">su pareja de siempre</div>)}
                            <GeoLinea patente={u.camion.patente} token={mapboxToken}
                              origen={origen} />
                          </div>
                          <button className={btnPri + " flex-none"}
                                  disabled={reservando === key}
                                  onClick={() => void reservar(u)}>
                            {reservando === key ? "Apartando…" : "Apartar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Hoy no tienes un equipo listo para esto{casi.length ? " — pero mira lo que falta:" : "."}
                </div>
              )}

              {/* 🟡 TE FALTA POCO */}
              {casi.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-amber-700 dark:text-amber-400 pb-2">
                    🟡 Te falta poco ({casi.length})
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {casi.map((u) => (
                      <div key={u.camion.id + u.conductor.id}
                           className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {u.camion.patente} con {u.conductor.nombre.split(" ").slice(0, 2).join(" ")}
                          {u.remolque && ` + ${u.remolque.patente}`}
                        </span>
                        <span className="text-gray-500"> — {u.acciones_recuperan
                          .map((a) => a.replace("registrar ", "falta "))
                          .join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ⛔ HOY NO (plegado) */}
              {no.length > 0 && (
                <div>
                  <button className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 inline-flex items-center gap-1"
                          onClick={() => setVerNo(!verNo)}>
                    {verNo ? <HiOutlineChevronUp className="w-4 h-4" /> : <HiOutlineChevronDown className="w-4 h-4" />}
                    No sirven para esto ({no.length})
                  </button>
                  {verNo && (
                    <div className="flex flex-col gap-1 pt-1.5">
                      {no.map((u) => (
                        <div key={u.camion.id + u.conductor.id} className="text-xs text-gray-500 pl-5">
                          {u.camion.patente} con {u.conductor.nombre.split(" ").slice(0, 2).join(" ")} — {u.causas[0]}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* ════ 3 · TUS EQUIPOS APARTADOS Y CONFIRMADOS ════ */}
      {vivas.length > 0 && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white pb-2">
            Tus equipos comprometidos
          </h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {vivas.map((u) => {
              const minsRestantes = u.expira_at ? Math.max(0, Math.round((u.expira_at - ahora) / 60)) : null;
              return (
                <div key={u.unit_id} className="flex items-center gap-3 py-2.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold flex-none ${
                    u.estado === "COMPROMETIDA"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"}`}>
                    {u.estado === "COMPROMETIDA" ? "Confirmado" : "Apartado"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {(u.miembros ?? []).map((m) => m.etiqueta?.split(" ").slice(0, 2).join(" ")).filter(Boolean).join(" + ")}
                    </div>
                    <div className="text-xs text-gray-500">
                      {fmtDia(u.ini)} · {fmtHora(u.ini)}–{fmtHora(u.fin)}
                      {u.estado === "RESERVADA" && minsRestantes != null &&
                        ` · se libera solo en ${minsRestantes} min si no confirmas`}
                    </div>
                  </div>
                  {u.estado === "RESERVADA" && (
                    <button className={btnPri + " flex-none"}
                            onClick={() => void comprometer(u.unit_id)}>
                      Confirmar
                    </button>
                  )}
                  <button className="text-xs text-rose-600 hover:underline flex-none"
                          onClick={() => void liberar(u.unit_id, u.estado)}>
                    soltar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
                onClick={() => setVerCumplimiento(!verCumplimiento)}>
          <HiOutlineWrenchScrewdriver className="w-5 h-5 text-gray-500 flex-none" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
            ¿Cumplimos lo prometido?
            {confiabilidad && confiabilidad.cerradas > 0 && (
              <span className="font-normal text-gray-500">
                {"  "}— {confiabilidad.ultimas_cerradas.filter((c) => c.resultado.estable).length} de {confiabilidad.cerradas} servicios salieron tal como se prometió
              </span>
            )}
          </span>
          {verCumplimiento ? <HiOutlineChevronUp className="w-4 h-4 text-gray-400" />
                           : <HiOutlineChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {verCumplimiento && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            {confiabilidad && confiabilidad.cerradas > 0 ? (<>
              {confiabilidad.ultimas_cerradas.map((c) => (
                <div key={c.unit_id} className="text-sm">
                  <div className="flex items-center gap-2">
                    {c.resultado.estable
                      ? <HiCheckCircle className="w-4 h-4 text-green-500 flex-none" />
                      : <HiOutlineExclamationTriangle className="w-4 h-4 text-amber-500 flex-none" />}
                    <span className="text-gray-900 dark:text-white">
                      Servicio {c.service_code ?? "—"} · {new Date(c.ini * 1000).toLocaleDateString("es-CL")}
                    </span>
                    <span className="text-xs text-gray-500">
                      {c.resultado.estable ? "salió como se prometió" : "salió con cambios"}
                    </span>
                  </div>
                  {c.resultado.sustituciones.map((sx, i) => (
                    <div key={i} className="text-xs text-gray-500 pl-6">
                      se prometió {sx.prometido} y salió {sx.ejecuto}
                    </div>
                  ))}
                </div>
              ))}
              {(confiabilidad.caidas.expiradas > 0 || confiabilidad.caidas.rebotes > 0) && (
                <div className="text-xs text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
                  {confiabilidad.caidas.expiradas > 0 &&
                    `${confiabilidad.caidas.expiradas} ${confiabilidad.caidas.expiradas === 1 ? "reserva se venció" : "reservas se vencieron"} sin confirmar. `}
                  {confiabilidad.caidas.rebotes > 0 &&
                    `${confiabilidad.caidas.rebotes} compromiso(s) soltados después de confirmar — eso baja tu confiabilidad.`}
                </div>
              )}
            </>) : (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <HiOutlineSun className="w-4 h-4" />
                Cuando tus equipos confirmados hagan sus viajes, aquí verás si
                salieron tal como se prometieron.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
    </div>
  );
}

// ── fila del Gantt (solo dentro de "Agenda completa") ──
function FilaAgenda({ etiqueta, id, tipo }: {
  etiqueta: string; id: string; tipo: "TRUCK" | "DRIVER";
}) {
  const t0 = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() / 1000; }, []);
  const t1 = t0 + 7 * 86400;
  const { data } = useSWR<Compromiso[] | { ok: false }>(
    `/app/api/ams/rpc/fn_cap_agenda?p_resource_type=${tipo}&p_resource_id=${id}`, fetcher);
  const compromisos = Array.isArray(data) ? data : [];
  const rango = t1 - t0;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-40 flex-none text-sm text-gray-900 dark:text-white truncate">
        <span className="text-[10px] mr-1.5">{tipo === "TRUCK" ? "🚚" : "👤"}</span>
        {etiqueta.split(" ").slice(0, 2).join(" ")}
      </div>
      <div className="relative flex-1 h-6 rounded bg-gray-50 dark:bg-gray-900/60 overflow-hidden">
        {[...Array(7)].map((_, i) => (
          <span key={i} className="absolute top-0 bottom-0 w-px bg-gray-200/70 dark:bg-gray-700/60"
                style={{ left: `${(i / 7) * 100}%` }} />
        ))}
        {compromisos.filter((c) => c.fin > t0 && c.ini < t1).map((c) => {
          const left = Math.max(0, ((c.ini - t0) / rango) * 100);
          const right = Math.min(100, ((c.fin - t0) / rango) * 100);
          return (
            <span key={c.commitment_id}
              className="absolute top-[3px] bottom-[3px] rounded-sm opacity-90"
              style={{ left: `${left}%`, width: `${Math.max(0.8, right - left)}%`,
                background: KIND_COLOR[c.kind] ?? "#6B7280" }}
              title={`${KIND_HUMANO[c.kind] ?? c.kind}${c.ref ? ` · ${c.ref}` : ""} · ${new Date(c.ini * 1000).toLocaleString("es-CL")} → ${new Date(c.fin * 1000).toLocaleString("es-CL")}`} />
          );
        })}
      </div>
    </div>
  );
}

// ── "¿Dónde está ahora?" — posición real + reverse geocoding (Mapbox,
// nuestro proveedor validado) + comparación con el origen elegido ──
function GeoLinea({ patente, origen, token }: {
  patente: string; origen: Lugar | null; token?: string;
}) {
  const { data: pos } = useSWR<{ ok: boolean; posicion: { lat: number; lon: number; ts: number } | null }>(
    `/app/api/ams/rpc/fn_cap_position?p_plate=${encodeURIComponent(patente)}`, fetcher,
    { dedupingInterval: 60000 });
  const p = pos?.posicion;
  const { data: geo } = useSWR<{ features?: { place_name?: string }[] }>(
    p && token
      ? `https://api.mapbox.com/geocoding/v5/mapbox.places/${p.lon.toFixed(5)},${p.lat.toFixed(5)}.json?language=es&types=address,place,locality&limit=1&access_token=${token}`
      : null, fetcher, { dedupingInterval: 300000 });

  if (!p) {
    return <div className="text-xs text-gray-400">📍 sin señal de posición reciente</div>;
  }
  const lugarTxt = geo?.features?.[0]?.place_name?.split(",").slice(0, 2).join(",")
    ?? `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;
  const dist = origen?.center
    ? kmEntre(p.lat, p.lon, origen.center[0], origen.center[1]) : null;
  return (
    <div className="text-xs text-gray-600 dark:text-gray-300 pt-0.5">
      📍 Está en {lugarTxt}
      <span className="text-gray-400"> · {hace(p.ts)}</span>
      {dist != null && origen && (
        <span className={dist > 120 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
          {" "}· a {dist < 10 ? dist.toFixed(1) : Math.round(dist)} km de {origen.name}
        </span>
      )}
      {" "}
      <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer"
         href={`https://www.google.com/maps?q=${p.lat},${p.lon}`}>mapa</a>
      {origen?.center && (
        <>
          {" · "}
          <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer"
             href={`https://www.google.com/maps/dir/${p.lat},${p.lon}/${origen.center[0]},${origen.center[1]}`}>
            ruta al origen
          </a>
        </>
      )}
    </div>
  );
}

// ── Escribir la dirección: geocoding DIRECTO de Mapbox (dirección →
// coordenada), la operación inversa del reverse que ya usamos. Debounce
// para no disparar en cada tecla; el resultado es un "lugar" con center. ──
function BuscadorDireccion({ token, elegido, onElegir }: {
  token?: string; elegido: Lugar | null; onElegir: (l: Lugar | null) => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useSWR<{ features?: { id: string; place_name: string;
    center: [number, number] }[] }>(
    debounced.trim().length >= 4 && token
      ? `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(debounced)}.json?country=cl&language=es&limit=5&access_token=${token}`
      : null, fetcher, { dedupingInterval: 300000 });

  if (elegido) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2.5 py-1">
          📍 {elegido.name}
        </span>
        <button className="text-xs text-gray-500 hover:underline"
                onClick={() => { onElegir(null); setQ(""); setDebounced(""); }}>
          cambiar
        </button>
      </div>
    );
  }
  return (
    <div className="relative max-w-xs">
      <input
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white"
        placeholder="…o escribe una dirección"
        value={q}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)} />
      {!token && q && (
        <div className="text-[11px] text-amber-600 pt-0.5">falta el mapa configurado</div>)}
      {abierto && (data?.features?.length ?? 0) > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
          {data!.features!.map((f) => (
            <button key={f.id}
              className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => {
                // Mapbox devuelve [lon,lat]; el resto del Desk usa [lat,lon]
                onElegir({ place_id: "addr:" + f.id, name: f.place_name.split(",").slice(0, 2).join(","),
                  center: [f.center[1], f.center[0]] });
                setAbierto(false);
              }}>
              {f.place_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

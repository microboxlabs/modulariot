"use client";

// Capacity Desk (capacity-core C2) — la pantalla del transportista:
//   1. Línea temporal de recursos (espejo DERIVADO de la operación: nada
//      que mantener; el carrier solo bloquea por excepción).
//   2. "Probar una necesidad" → unidades candidatas EXPLICADAS del motor
//      C1 (disponible / con condición / recuperable / no disponible).
//   3. Reservar = materializar la UO con vigencia; las reservas expiran
//      solas. Principios del doc rector: transportista controla su oferta,
//      toda conclusión explicable, reservas con vigencia.
import { useMemo, useState } from "react";
import useSWR from "swr";
import { TextInput, Select as DsSelect } from "flowbite-react";
import {
  HiOutlineCalendarDays, HiOutlineMagnifyingGlass, HiOutlineBookmark,
} from "react-icons/hi2";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";
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
  gxc: { camion_tasa: number | null; camion_viajes: number | null;
    conductor_tasa: number | null; conductor_viajes: number | null };
};
type Arquetipo = {
  archetype_id: number; nombre: string; descripcion: string | null;
  truck_type: string | null; license_cat: string | null;
  n_conductores: number; remolque: string;
};
type UnidadReservada = {
  unit_id: string; estado: string; ini: number; fin: number;
  expira_at: number | null;
  miembros: { rol: string; etiqueta: string | null }[];
};

const KIND_COLOR: Record<string, string> = {
  SERVICIO: "#1C64F2", MANTENCION: "#F1B300", RESERVA: "#7E3AF2",
  BLOQUEO: "#111928", INDISPONIBILIDAD: "#E11D48",
};
const VEREDICTO_META: Record<string, { l: string; cls: string }> = {
  DISPONIBLE: { l: "Disponible", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  CON_CONDICION: { l: "Con condición", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  RECUPERABLE: { l: "Recuperable", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  NO_DISPONIBLE: { l: "No disponible", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const btnPri = "rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50";
const btnSec = "rounded-lg border border-gray-300 dark:border-gray-600 text-sm px-3 py-1.5 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700";

function Panel({ titulo, icono: Icono, extra, children }: {
  titulo: string; icono: React.ComponentType<{ className?: string }>;
  extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-2.5 px-3.5 py-2 border-b border-gray-100 dark:border-gray-700">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex-none">
          <Icono className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </span>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{titulo}</h3>
        {extra}
      </div>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

// ── Línea temporal: filas = recursos, 7 días desde hoy 00:00 ──
function FilaTimeline({ etiqueta, recId, tipo, t0, t1 }: {
  etiqueta: string; recId: string; tipo: "TRUCK" | "DRIVER"; t0: number; t1: number;
}) {
  const { data } = useSWR<Compromiso[] | { ok: false }>(
    `/app/api/ams/rpc/fn_cap_agenda?p_resource_type=${tipo}&p_resource_id=${recId}`, fetcher);
  const compromisos = Array.isArray(data) ? data : [];
  const rango = t1 - t0;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-44 flex-none text-sm text-gray-900 dark:text-white truncate">
        <span className="text-[10px] uppercase text-gray-400 mr-1.5">
          {tipo === "TRUCK" ? "🚚" : "👤"}
        </span>
        {etiqueta}
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
              title={`${c.kind}${c.ref ? ` · ${c.ref}` : ""} · ${new Date(c.ini * 1000).toLocaleString("es-CL")} → ${new Date(c.fin * 1000).toLocaleString("es-CL")}`} />
          );
        })}
      </div>
    </div>
  );
}

export function CapacityDesk() {
  const { carrierMode } = useCarrierMode();
  const { data: trucks } = useSWR<AmsTruck[]>("/app/api/ams/rpc/fn_ams_trucks", fetcher);
  const { data: drivers } = useSWR<AmsDriver[]>("/app/api/ams/rpc/fn_ams_drivers", fetcher);
  const { data: unidades, mutate: mutUnidades } = useSWR<UnidadReservada[]>(
    "/app/api/ams/rpc/fn_cap_units", fetcher);
  const { data: arquetipos } = useSWR<Arquetipo[]>(
    "/app/api/ams/rpc/fn_cap_archetypes", fetcher);

  // ventana de la línea temporal: hoy 00:00 + 7 días
  const t0 = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() / 1000; }, []);
  const t1 = t0 + 7 * 86400;
  const dias = useMemo(() => [...Array(7)].map((_, i) =>
    new Date((t0 + i * 86400) * 1000).toLocaleDateString("es-CL", { weekday: "short", day: "2-digit" })), [t0]);

  // necesidad
  const hoy = new Date(); hoy.setDate(hoy.getDate() + 1);
  const [fecha, setFecha] = useState(hoy.toISOString().slice(0, 10));
  const [hIni, setHIni] = useState("08:00");
  const [hFin, setHFin] = useState("18:00");
  const [arq, setArq] = useState("");           // archetype_id o "" = personalizado
  const [tipoEq, setTipoEq] = useState("");
  const [lic, setLic] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<{ unidades: Unidad[]; resumen: Record<string, number> } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reservando, setReservando] = useState<string | null>(null);
  const [sync, setSync] = useState(false);

  const buscar = async () => {
    setBuscando(true); setMsg(null); setResultado(null);
    const { data } = await post("fn_capacity_match", {
      p_ini: new Date(`${fecha}T${hIni}`).toISOString(),
      p_fin: new Date(`${fecha}T${hFin}`).toISOString(),
      p_archetype_id: arq ? Number(arq) : null,
      p_truck_type: arq ? null : (tipoEq || null),
      p_license_cat: arq ? null : (lic || null),
    });
    setBuscando(false);
    if (!data?.ok) { setMsg(`No se pudo calcular — ${data?.error ?? "error"}`); return; }
    setResultado({ unidades: data.unidades ?? [], resumen: data.resumen ?? {} });
  };

  const reservar = async (u: Unidad) => {
    setReservando(u.camion.id + u.conductor.id); setMsg(null);
    const { data } = await post("fn_cap_reserve", {
      p_truck_id: u.camion.id,
      p_driver_ids: [u.conductor.id, ...(u.conductor2 ? [u.conductor2.id] : [])],
      p_trailer_id: u.remolque?.id ?? null,
      p_ini: new Date(`${fecha}T${hIni}`).toISOString(),
      p_fin: new Date(`${fecha}T${hFin}`).toISOString(),
      p_ttl_minutes: 30,
      p_necesidad: { fecha, ini: hIni, fin: hFin,
        arquetipo: arq ? Number(arq) : null, tipo: tipoEq || null },
      p_snapshot: u as unknown as Record<string, unknown>,
      p_actor: "capacity-desk",
    });
    setReservando(null);
    if (!data?.ok) {
      setMsg(data?.error === "conflicto"
        ? "El recurso quedó ocupado entre medio — recalcula la búsqueda"
        : `No reservado — ${data?.error}`);
      return;
    }
    void mutUnidades(); void buscar();
  };

  const liberar = async (unitId: string) => {
    if (!window.confirm("¿Liberar esta reserva? Se suelta la agenda de todos los miembros.")) return;
    await post("fn_cap_release", { p_unit_id: unitId, p_actor: "capacity-desk" });
    void mutUnidades();
  };

  const sincronizar = async () => {
    setSync(true);
    await post("fn_cap_refresh_agenda", {});
    setSync(false);
    window.location.reload();
  };

  const recursos = [
    ...(trucks ?? []).map((t) => ({ tipo: "TRUCK" as const, id: t.id, etiqueta: t.license_plate })),
    ...(drivers ?? []).map((d) => ({ tipo: "DRIVER" as const, id: d.id, etiqueta: d.full_name })),
  ];

  return (
    <div className="flex flex-col gap-3 p-4 xl:px-8 w-full">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Capacidad</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Qué puedes comprometer y cuándo — agenda derivada de la operación,
            libre hasta donde sabemos.
          </p>
        </div>
        {!carrierMode && (
          <button className={btnSec} disabled={sync} onClick={() => void sincronizar()}>
            {sync ? "Sincronizando…" : "Sincronizar operación"}
          </button>
        )}
      </div>

      {/* 1 · línea temporal de recursos */}
      <Panel titulo="Agenda de recursos · próximos 7 días" icono={HiOutlineCalendarDays}
        extra={<div className="flex items-center gap-2 text-[11px] text-gray-500">
          {Object.entries(KIND_COLOR).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ background: c }} />{k.toLowerCase()}
            </span>
          ))}
        </div>}>
        <div className="flex items-center gap-3 pb-1">
          <div className="w-44 flex-none" />
          <div className="flex-1 grid grid-cols-7 text-[10px] uppercase tracking-wide text-gray-400">
            {dias.map((d) => <span key={d}>{d}</span>)}
          </div>
        </div>
        {recursos.length
          ? recursos.map((r) => (
              <FilaTimeline key={r.id} etiqueta={r.etiqueta} recId={r.id}
                            tipo={r.tipo} t0={t0} t1={t1} />
            ))
          : <div className="text-sm text-gray-500">Sin recursos en el maestro todavía.</div>}
      </Panel>

      {/* 2 · probar una necesidad */}
      <Panel titulo="Probar una necesidad" icono={HiOutlineMagnifyingGlass}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Fecha</span>
            <TextInput sizing="sm" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Desde</span>
            <TextInput sizing="sm" type="time" value={hIni} onChange={(e) => setHIni(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Hasta</span>
            <TextInput sizing="sm" type="time" value={hFin} onChange={(e) => setHFin(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Tipo de servicio</span>
            <DsSelect sizing="sm" value={arq} onChange={(e) => setArq(e.target.value)}>
              <option value="">Personalizado</option>
              {(arquetipos ?? []).map((a) => (
                <option key={a.archetype_id} value={a.archetype_id}>
                  {a.nombre}
                </option>
              ))}
            </DsSelect>
          </div>
          {!arq && (<>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Tipo de equipo</span>
            <DsSelect sizing="sm" value={tipoEq} onChange={(e) => setTipoEq(e.target.value)}>
              <option value="">Cualquiera</option>
              <option value="rampla">Rampla</option><option value="tolva">Tolva</option>
              <option value="cama_baja">Cama baja</option><option value="sider">Sider</option>
              <option value="tracto">Tracto</option>
            </DsSelect>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Licencia</span>
            <DsSelect sizing="sm" value={lic} onChange={(e) => setLic(e.target.value)}>
              <option value="">Cualquiera</option>
              <option value="A2">A2</option><option value="A3">A3</option>
              <option value="A4">A4</option><option value="A5">A5</option>
            </DsSelect>
          </div>
          </>)}
          {arq && (
            <span className="text-[11px] text-gray-500 pb-2 max-w-[260px]">
              {(arquetipos ?? []).find((a) => String(a.archetype_id) === arq)?.descripcion}
            </span>
          )}
          <button className={btnPri} disabled={buscando} onClick={() => void buscar()}>
            {buscando ? "Calculando…" : "Calcular capacidad"}
          </button>
        </div>

        {msg && <div className="text-sm text-red-600 dark:text-red-400 pt-2">{msg}</div>}

        {resultado && (
          <div className="pt-3 flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap text-xs">
              {Object.entries(resultado.resumen).map(([k, n]) => (
                <span key={k} className={`rounded-full px-2 py-0.5 font-medium ${VEREDICTO_META[k]?.cls ?? ""}`}>
                  {VEREDICTO_META[k]?.l ?? k}: {n}
                </span>
              ))}
              {!resultado.unidades.length && (
                <span className="text-gray-500">Sin combinaciones en el ámbito.</span>)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2">
              {resultado.unidades.map((u) => {
                const vm = VEREDICTO_META[u.veredicto];
                const key = u.camion.id + u.conductor.id;
                return (
                  <div key={key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${vm?.cls}`}>{vm?.l}</span>
                      {u.dupla_vigente && (
                        <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">dupla vigente</span>)}
                      <span className="ml-auto text-sm font-bold text-gray-900 dark:text-white"
                            title="confianza — libre hasta donde sabemos">
                        {u.confianza}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {u.camion.patente}
                      <span className="text-gray-400 font-normal"> {u.camion.tipo ?? ""} · </span>
                      {u.conductor.nombre}
                      {u.conductor2 && <span> + {u.conductor2.nombre}</span>}
                      {u.remolque && (
                        <span className="text-gray-500 font-normal"> + remolque {u.remolque.patente}</span>)}
                    </div>
                    {u.causas.map((c, i) => (
                      <div key={i} className="text-xs text-red-600 dark:text-red-400">✕ {c}</div>))}
                    {u.condiciones.map((c, i) => (
                      <div key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠ {c}</div>))}
                    {u.acciones_recuperan.map((c, i) => (
                      <div key={i} className="text-xs text-blue-600 dark:text-blue-400">↻ {c}</div>))}
                    {(u.veredicto === "DISPONIBLE" || u.veredicto === "CON_CONDICION") && (
                      <button className={btnPri + " mt-1 self-start"}
                              disabled={reservando === key}
                              onClick={() => void reservar(u)}>
                        {reservando === key ? "Reservando…" : "Reservar 30 min"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      {/* 3 · reservas activas (UO vivas) */}
      <Panel titulo="Reservas y compromisos" icono={HiOutlineBookmark}
        extra={<span className="text-[11px] text-gray-500">las reservas expiran solas</span>}>
        {(unidades ?? []).length ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {(unidades ?? []).map((u) => (
              <div key={u.unit_id} className="flex items-center gap-3 py-2">
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                  {u.estado}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900 dark:text-white truncate">
                    {(u.miembros ?? []).map((m) => m.etiqueta).filter(Boolean).join(" + ")}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(u.ini * 1000).toLocaleString("es-CL")} → {new Date(u.fin * 1000).toLocaleString("es-CL")}
                    {u.expira_at && u.estado === "RESERVADA" &&
                      ` · expira ${new Date(u.expira_at * 1000).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                </div>
                {(u.estado === "RESERVADA" || u.estado === "COMPROMETIDA") && (
                  <button className="text-[11px] text-rose-600 hover:underline flex-none"
                          onClick={() => void liberar(u.unit_id)}>
                    liberar
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Sin reservas vivas.</div>
        )}
      </Panel>
    </div>
  );
}

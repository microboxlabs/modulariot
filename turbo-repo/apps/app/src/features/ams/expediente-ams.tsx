"use client";

// EXPEDIENTE del recurso (referencia: expediente de VIAJE del app) —
// funcionalidades bien distribuidas en zonas, no un apilado de cards:
//   ┌─────────────────────────────┬──────────────────┐
//   │ Información del recurso     │ Acreditación     │  ← checklist estilo
//   │ (campos etiquetados en      │ (requisitos con  │    "Validaciones"
//   │  columnas + editar)         │  estado ●)       │
//   ├─────────────────────────────┼──────────────────┤
//   │ Documentos (estilo          │ Asignación       │  ← estilo panel
//   │  MULTIMEDIA: pestañas       │ (dupla + reasig. │    "Conductores"
//   │  vigentes/por vencer +      │  + historial)    │
//   │  registrar)                 │                  │
//   ├─────────────────────────────┴──────────────────┤
//   │ GxC del recurso · Historial de cambios (tabla) │
//   └────────────────────────────────────────────────┘
import useSWR from "swr";
import { KpiStat } from "@/features/common/components/kpi-stat";
import {
  HiOutlineShieldCheck, HiOutlineDocumentCheck, HiOutlineUserCircle, HiOutlineChartBar,
  HiOutlineIdentification, HiOutlineClock, HiCheckCircle, HiXCircle, HiExclamationTriangle,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import {
  FichaAms, useAmsRecord, SeccionDocs, SeccionDupla, DOC_LABEL,
  type AmsTruck, type AmsDriver,
} from "./ficha-ams";
import { SeccionForo } from "./seccion-foro";
import { MIX_META, type PerfilGxc } from "@/features/gxc/model";
import {
  HiOutlineChatBubbleLeftRight, HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown,
} from "react-icons/hi2";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

function Panel({ titulo, icono: Icono, extra, children, className }: {
  titulo: string; icono?: IconType; extra?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col min-h-0 ${className ?? ""}`}>
      <div className="flex items-center gap-2.5 px-3.5 py-2 border-b border-gray-100 dark:border-gray-700 flex-none">
        {Icono && (
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex-none">
            <Icono className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </span>
        )}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{titulo}</h3>
        {extra}
      </div>
      <div className="p-3.5 flex-1 min-h-0 overflow-y-auto">{children}</div>
    </section>
  );
}

// ● estado estilo checklist de Validaciones del viaje
function ItemCheck({ ok, warn, label, detalle }: {
  ok: boolean; warn?: boolean; label: string; detalle?: string;
}) {
  const Icon = ok ? HiCheckCircle : warn ? HiExclamationTriangle : HiXCircle;
  const cls = ok ? "text-green-500" : warn ? "text-yellow-400" : "text-red-500";
  return (
    <div className="flex items-center gap-2 text-sm py-[5px]">
      <Icon className={`w-[18px] h-[18px] flex-none ${cls}`} />
      <span className="text-gray-900 dark:text-white flex-1">{label}</span>
      {detalle && <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{detalle}</span>}
    </div>
  );
}

function BarraCompletitud({ ok, total }: { ok: number; total: number }) {
  const pctv = total ? Math.round((ok / total) * 100) : 0;
  return (
    <div className="pb-2">
      <div className="flex items-baseline justify-between text-xs pb-1">
        <span className="text-gray-500 dark:text-gray-400">Requisitos cumplidos</span>
        <span className="font-semibold text-gray-900 dark:text-white">{ok}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className="h-full rounded-full transition-all"
             style={{ width: `${pctv}%`,
               background: pctv === 100 ? "#0E9F6E" : pctv >= 50 ? "#D97706" : "#E11D48" }} />
      </div>
    </div>
  );
}

/** Expediente distribuido del recurso AMS (camión o colaborador). */
export function ExpedienteAms({ tipo, matchId, matchName }: {
  tipo: "TRUCK" | "DRIVER"; matchId?: string; matchName?: string;
}) {
  const { rec, cargando, mutate } = useAmsRecord(tipo, matchId, matchName);
  if (cargando) return null;

  // Sin ficha: invitación integrada (panel único, prellenado)
  if (!rec) {
    return (
      <Panel titulo={tipo === "TRUCK" ? "Ficha del camión" : "Ficha del colaborador"}>
        <FichaAms tipo={tipo} matchId={matchId} matchName={matchName}
                  variante="plano" secciones={["identificacion"]} />
      </Panel>
    );
  }

  const a = rec.acreditacion;
  const docs = a.documentos;
  const extOk = !a.bloqueada_por.includes("fuente_externa");

  const docsReq = docs.docs.filter((d) => d.required);
  const docsOk = docsReq.filter((d) => d.estado === "vigente" || d.estado === "sin_vencimiento").length;
  const docsPorVencer = docsReq.filter((d) => d.estado === "por_vencer" || d.estado === "urgente").length;
  const reqTotal = docsReq.length + docs.faltantes.length;
  const asignado = tipo === "TRUCK"
    ? (rec as AmsTruck).conductor?.nombre : (rec as AmsDriver).camion?.patente;
  const desde = tipo === "TRUCK"
    ? (rec as AmsTruck).conductor?.desde : (rec as AmsDriver).camion?.desde;

  return (
    <div className="flex flex-col gap-3">
      {/* nivel 1 — el estado del recurso de un vistazo (sin scroll) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiStat variant="horizontal"
          icon={{ icon: HiOutlineShieldCheck,
            className: a.acreditado ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400" }}
          title={{ text: "Acreditación" }}
          value={{ text: a.acreditado ? "Acreditado" : "No acreditado",
            className: a.acreditado ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400" }}
          description={{ text: a.acreditado
            ? "todas las fuentes avalan"
            : `bloqueada por ${a.bloqueada_por.map((b) => b === "documentos" ? "documentos" : "fuente externa").join(" + ")}` }} />
        <KpiStat variant="horizontal"
          icon={{ icon: HiOutlineDocumentCheck,
            className: docs.faltantes.length || docsOk < docsReq.length
              ? "text-red-600 dark:text-red-400"
              : docsPorVencer ? "text-yellow-500" : "text-green-600 dark:text-green-400" }}
          title={{ text: "Documentos obligatorios" }}
          value={{ text: `${docsOk}/${reqTotal}` }}
          description={{ text: docs.faltantes.length
            ? `faltan ${docs.faltantes.length}`
            : docsPorVencer ? `${docsPorVencer} por vencer` : "al día" }} />
        <KpiStat variant="horizontal"
          icon={{ icon: HiOutlineUserCircle,
            className: asignado ? "text-blue-600 dark:text-blue-400" : "text-yellow-500" }}
          title={{ text: tipo === "TRUCK" ? "Conductor asignado" : "Camión asignado" }}
          value={{ text: asignado ?? "Sin asignar" }}
          description={{ text: desde
            ? `desde ${new Date(desde).toLocaleDateString("es-CL")}` : "asigna desde el panel" }} />
        <KpiGxc tipo={tipo} rec={rec} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 auto-rows-min">
      {/* fila 1 — bento: info (6) · acreditación (3) · asignación (3) */}
      <Panel className="xl:col-span-6" icono={HiOutlineIdentification} titulo={tipo === "TRUCK" ? "Información del camión" : "Información del colaborador"}>
        <FichaAms tipo={tipo} matchId={matchId} matchName={matchName}
                  variante="plano" secciones={["identificacion"]} />
      </Panel>

      <Panel className="xl:col-span-3" icono={HiOutlineShieldCheck} titulo="Acreditación"
        extra={<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          a.acreditado
            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}`}>
          {a.acreditado ? "Acreditado" : "No acreditado"}
        </span>}>
        <div className="flex flex-col">
          <BarraCompletitud
            ok={(extOk ? 1 : 0) + docs.docs.filter((d) => d.required && (d.estado === "vigente" || d.estado === "sin_vencimiento")).length}
            total={1 + docs.docs.filter((d) => d.required).length + docs.faltantes.length} />
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 pb-0.5">
            Fuentes
          </div>
          <ItemCheck ok={extOk} label="Fuente externa" detalle={extOk ? "avala" : "bloquea"} />
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 pt-2 pb-0.5">
            Documentos obligatorios
          </div>
          {docs.docs.filter((d) => d.required).map((d) => (
            <ItemCheck key={d.doc_id}
              ok={d.estado === "vigente" || d.estado === "sin_vencimiento"}
              warn={d.estado === "por_vencer" || d.estado === "urgente"}
              label={d.label ?? d.doc_type}
              detalle={d.valid_until ? `vence ${d.valid_until.slice(0, 10)}` : undefined} />
          ))}
          {docs.faltantes.map((f) => (
            <ItemCheck key={f.doc_type} ok={false} label={f.label} detalle="falta" />
          ))}
          {!docs.docs.some((d) => d.required) && !docs.faltantes.length && (
            <div className="text-xs text-gray-500">Sin requisitos documentales.</div>
          )}
        </div>
      </Panel>

      <Panel className="xl:col-span-3" icono={HiOutlineUserCircle} titulo={tipo === "TRUCK" ? "Conductor" : "Camión"}
        extra={<span className="text-[11px] text-gray-500">manda el viaje</span>}>
        <SeccionDupla tipo={tipo} rec={rec} plano onChange={() => void mutate()} />
      </Panel>

      {/* fila 2 — documentos (8) · foro (4): gestión documental y conversación
          del recurso, mismos ciudadanos que en el expediente de servicio */}
      <Panel className="xl:col-span-8" icono={HiOutlineDocumentCheck} titulo="Documentos"
        extra={<span className="text-xs text-gray-500">
          {docs.docs.length} registrados{docs.faltantes.length ? ` · faltan ${docs.faltantes.length}` : ""}
        </span>}>
        <SeccionDocs tipo={tipo} rec={rec} plano onChange={() => void mutate()} />
      </Panel>

      <Panel className="xl:col-span-4" icono={HiOutlineChatBubbleLeftRight} titulo="Foro"
        extra={<span className="text-[11px] text-gray-500">conversación del recurso</span>}>
        <SeccionForo tipo={tipo} recId={rec.id} />
      </Panel>

      {/* fila 3 — comportamiento (6) · auditoría (6) */}
      <Comportamiento tipo={tipo} rec={rec} />
      <HistorialTabla tipo={tipo} recId={rec.id} />
      </div>
    </div>
  );
}

// KPI de GxC (comparte el fetch del strip)
function KpiGxc({ tipo, rec }: { tipo: "TRUCK" | "DRIVER"; rec: AmsTruck | AmsDriver }) {
  const gxcTipo = tipo === "TRUCK" ? "camion" : "conductor";
  const gxcId = tipo === "TRUCK" ? (rec as AmsTruck).license_plate : (rec as AmsDriver).full_name;
  const { data } = useSWR<{ capitulos: { viajes: number; con_consecuencia: number } | null }>(
    `/app/api/gemelo/rpc/fn_dx_gol_gxc_perfil?p_tipo=${gxcTipo}&p_id=${encodeURIComponent(gxcId)}&p_dias=28`,
    fetcher);
  const cap = data?.capitulos;
  const tasa = cap && cap.viajes > 0
    ? Math.round((cap.con_consecuencia / Math.max(1, cap.viajes)) * 100) : null;
  return (
    <KpiStat variant="horizontal"
      icon={{ icon: HiOutlineChartBar,
        className: tasa == null ? "text-gray-400"
          : tasa >= 50 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400" }}
      title={{ text: "GxC · 28 días" }}
      value={{ text: tasa == null ? "—" : `${tasa}%`,
        className: tasa == null ? "text-gray-400" : undefined }}
      description={{ text: cap && cap.viajes > 0
        ? `${cap.viajes} viajes cerrados` : "sin historia operacional" }} />
  );
}

// Comportamiento del recurso — resumen accionable del standing GxC
// (trayectoria, síntomas, consecuencias, respuesta) con salto directo al
// SUPER PERFIL, que es donde vive el análisis completo (historia
// operacional viaje a viaje, síntomas en el tiempo, tratamientos).
function Comportamiento({ tipo, rec }: { tipo: "TRUCK" | "DRIVER"; rec: AmsTruck | AmsDriver }) {
  const gxcTipo = tipo === "TRUCK" ? "camion" : "conductor";
  const gxcId = tipo === "TRUCK" ? (rec as AmsTruck).license_plate : (rec as AmsDriver).full_name;
  const { data: p } = useSWR<PerfilGxc>(
    `/app/api/gemelo/rpc/fn_dx_gol_gxc_perfil?p_tipo=${gxcTipo}&p_id=${encodeURIComponent(gxcId)}&p_dias=28`,
    fetcher);
  const cap = p?.capitulos;
  const urlPerfil = `/app/es/gxc/${gxcTipo}/${encodeURIComponent(gxcId)}?dias=28`;

  const tasa = cap && cap.viajes > 0
    ? Math.round((cap.con_consecuencia / Math.max(1, cap.viajes)) * 100) : null;
  const tasaPrev = p?.tendencia?.tasa_prev != null
    ? Math.round(Number(p.tendencia.tasa_prev) * 100) : null;
  const delta = tasa != null && tasaPrev != null ? tasa - tasaPrev : null;
  const nSintomas = (p?.timeline?.sintomas ?? []).reduce((acc, x) => acc + x.n, 0);
  const pendientes = p?.respuesta ? p.respuesta.total - p.respuesta.expirados : 0;

  return (
    <Panel className="xl:col-span-6" icono={HiOutlineChartBar}
      titulo="Comportamiento (GxC · 28 días)"
      extra={cap && cap.viajes > 0 ? (
        <a className={
          "rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5"}
          href={urlPerfil}>
          Ver perfil completo →</a>) : undefined}>
      {cap && cap.viajes > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-semibold text-gray-900 dark:text-white">{tasa}%</span>
            <span className="text-sm text-gray-500">
              de {cap.viajes} viajes cerró con consecuencia</span>
            {delta != null && delta !== 0 && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                delta > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                {delta > 0 ? <HiOutlineArrowTrendingUp className="w-4 h-4" />
                           : <HiOutlineArrowTrendingDown className="w-4 h-4" />}
                {delta > 0 ? "+" : ""}{delta} pts vs período anterior
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
            {[
              ["Viajes", String(cap.viajes)],
              ["Síntomas", String(nSintomas)],
              ["Consecuencias", String(cap.con_consecuencia)],
              ["Respuestas abiertas", String(pendientes)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{k}</dt>
                <dd className="text-base font-semibold text-gray-900 dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(cap.mix ?? {}).filter(([, v]) => v > 0).map(([k, v]) => (
              <span key={k} title={MIX_META[k]?.nota}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                <span className="w-2 h-2 rounded-full" style={{ background: MIX_META[k]?.color ?? "#9CA3AF" }} />
                {MIX_META[k]?.label ?? k} <b>{v}</b>
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            El análisis completo — historia viaje a viaje, síntomas en el tiempo,
            tratamientos y contraste con/sin exposición — vive en el perfil.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 flex-none" />
          Sin historia operacional todavía — el comportamiento aparece con el primer viaje cerrado.
        </div>
      )}
    </Panel>
  );
}

type EventoAms = {
  event_type: string;
  payload: { actor?: string; before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null };
  created_at: string;
};

// Qué cambió, en palabras — sin esto la auditoría es solo fechas
const CAMPO_LABEL: Record<string, string> = {
  status: "estado", phone: "teléfono", license_category: "licencia",
  license_expires: "vencimiento licencia", truck_type: "tipo", vin: "VIN",
  max_weight: "peso máx.", description: "descripción", full_name: "nombre",
};
function detalleEvento(e: EventoAms): string {
  const b = e.payload?.before ?? {}; const a = e.payload?.after ?? {};
  switch (e.event_type) {
    case "CREATE": return "Alta del recurso en el maestro";
    case "DOC_UPLOAD": {
      const t = String(a?.doc_type ?? "");
      const v = a?.valid_until ? ` · vence ${String(a.valid_until).slice(0, 10)}` : "";
      return `${DOC_LABEL[t] ?? t}${v}`;
    }
    case "DOC_DELETE": {
      const t = String((b as { doc_type?: string })?.doc_type ?? "");
      return DOC_LABEL[t] ?? t;
    }
    case "ASSIGN": return "Se formó la dupla conductor–camión";
    case "UNASSIGN": return "Se deshizo la dupla conductor–camión";
    case "UPDATE": {
      const cambios = Object.keys(CAMPO_LABEL)
        .filter((k) => b && a && JSON.stringify((b as Record<string, unknown>)[k]) !== JSON.stringify((a as Record<string, unknown>)[k]))
        .map((k) => `${CAMPO_LABEL[k]}: ${String((b as Record<string, unknown>)[k] ?? "—")} → ${String((a as Record<string, unknown>)[k] ?? "—")}`);
      return cambios.slice(0, 3).join(" · ") + (cambios.length > 3 ? ` · +${cambios.length - 3} más` : "");
    }
    default: return "";
  }
}

function HistorialTabla({ tipo, recId }: { tipo: "TRUCK" | "DRIVER"; recId: string }) {
  const { data } = useSWR<EventoAms[]>(
    `/app/api/ams/rpc/fn_ams_events?p_entity_type=${tipo}&p_entity_id=${recId}&p_limit=12`, fetcher);
  const OP: Record<string, { l: string; cls: string }> = {
    CREATE: { l: "Creación", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    UPDATE: { l: "Edición", cls: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" },
    DOC_UPLOAD: { l: "Documento registrado", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
    DOC_DELETE: { l: "Documento eliminado", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
    ASSIGN: { l: "Asignación", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
    UNASSIGN: { l: "Desasignación", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  };
  return (
    <Panel className="xl:col-span-6" icono={HiOutlineClock} titulo="Auditoría del maestro"
      extra={<span className="text-[11px] text-gray-500">quién cambió qué y cuándo</span>}>
      {data?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="py-1.5 pr-4 font-medium">Operación</th>
                <th className="py-1.5 pr-4 font-medium">Detalle</th>
                <th className="py-1.5 pr-4 font-medium">Realizado por</th>
                <th className="py-1.5 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700/60">
                  <td className="py-1.5 pr-4 whitespace-nowrap">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OP[e.event_type]?.cls ?? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}`}>
                      {OP[e.event_type]?.l ?? e.event_type}</span></td>
                  <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-300">
                    {detalleEvento(e) || "—"}</td>
                  <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {e.payload?.actor ?? "—"}</td>
                  <td className="py-1.5 text-gray-500 dark:text-gray-400">
                    {new Date(e.created_at).toLocaleString("es-CL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-gray-500">Sin cambios registrados.</div>
      )}
    </Panel>
  );
}

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
import { useState } from "react";
import useSWR from "swr";
import {
  FichaAms, useAmsRecord, SeccionDocs, SeccionDupla,
  type AmsTruck, type AmsDriver,
} from "./ficha-ams";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

function Panel({ titulo, extra, children, className }: {
  titulo: string; extra?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col ${className ?? ""}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{titulo}</h3>
        {extra}
      </div>
      <div className="p-4 flex-1 min-h-0">{children}</div>
    </section>
  );
}

// ● estado estilo checklist de Validaciones del viaje
function ItemCheck({ ok, warn, label, detalle }: {
  ok: boolean; warn?: boolean; label: string; detalle?: string;
}) {
  const color = ok ? "bg-green-500" : warn ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2.5 text-sm py-1">
      <span className={`w-3.5 h-3.5 rounded-full flex-none ${color}`} />
      <span className="text-gray-900 dark:text-white flex-1">{label}</span>
      {detalle && <span className="text-xs text-gray-500 dark:text-gray-400">{detalle}</span>}
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* ── Información del recurso (como "Información del viaje") ── */}
      <Panel className="lg:col-span-2"
        titulo={tipo === "TRUCK" ? "Información del camión" : "Información del colaborador"}>
        <FichaAms tipo={tipo} matchId={matchId} matchName={matchName}
                  variante="plano" secciones={["identificacion"]} />
      </Panel>

      {/* ── Acreditación (checklist estilo "Validaciones") ── */}
      <Panel titulo="Acreditación"
        extra={<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          a.acreditado
            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}`}>
          {a.acreditado ? "Acreditado" : "No acreditado"}
        </span>}>
        <div className="flex flex-col">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 pb-1">
            Fuentes
          </div>
          <ItemCheck ok={extOk} label="Fuente externa" detalle={extOk ? "avala" : "bloquea"} />
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 pt-3 pb-1">
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

      {/* ── Documentos (estilo MULTIMEDIA) ── */}
      <Panel className="lg:col-span-2" titulo="Documentos"
        extra={<span className="text-xs text-gray-500">
          {docs.docs.length} registrados{docs.faltantes.length ? ` · faltan ${docs.faltantes.length}` : ""}
        </span>}>
        <SeccionDocs tipo={tipo} rec={rec} plano onChange={() => void mutate()} />
      </Panel>

      {/* ── Asignación (estilo panel "Conductores") ── */}
      <Panel titulo={tipo === "TRUCK" ? "Conductor" : "Camión"}
        extra={<span className="text-[11px] text-gray-500">manda el viaje</span>}>
        <SeccionDupla tipo={tipo} rec={rec} plano onChange={() => void mutate()} />
      </Panel>

      {/* ── GxC + Historial (tabla estilo "Movimientos de Kanban") ── */}
      <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <GxcStrip tipo={tipo} rec={rec} />
        <HistorialTabla tipo={tipo} recId={rec.id} />
      </div>
    </div>
  );
}

function GxcStrip({ tipo, rec }: { tipo: "TRUCK" | "DRIVER"; rec: AmsTruck | AmsDriver }) {
  const gxcTipo = tipo === "TRUCK" ? "camion" : "conductor";
  const gxcId = tipo === "TRUCK" ? (rec as AmsTruck).license_plate : (rec as AmsDriver).full_name;
  const { data } = useSWR<{ capitulos: { viajes: number; con_consecuencia: number;
    mix: Record<string, number> } | null }>(
    `/app/api/gemelo/rpc/fn_dx_gol_gxc_perfil?p_tipo=${gxcTipo}&p_id=${encodeURIComponent(gxcId)}&p_dias=28`,
    fetcher);
  const cap = data?.capitulos;
  return (
    <Panel titulo="Gestión por consecuencia (28 días)"
      extra={cap && cap.viajes > 0 ? (
        <a className="text-xs text-blue-600 hover:underline"
           href={`/app/es/gxc/${gxcTipo}/${encodeURIComponent(gxcId)}?dias=28`}>
          ver perfil →</a>) : undefined}>
      {cap && cap.viajes > 0 ? (
        <div className="space-y-2">
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">
            {Math.round((cap.con_consecuencia / Math.max(1, cap.viajes)) * 100)}%
            <span className="text-sm font-normal text-gray-500 ml-2">
              de {cap.viajes} viajes con consecuencia</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(cap.mix ?? {}).filter(([, v]) => v > 0).map(([k, v]) => (
              <span key={k} className="rounded-full px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {k} <b>{v}</b>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">Sin historia operacional todavía.</div>
      )}
    </Panel>
  );
}

function HistorialTabla({ tipo, recId }: { tipo: "TRUCK" | "DRIVER"; recId: string }) {
  const { data } = useSWR<{ event_type: string; payload: { actor?: string }; created_at: string }[]>(
    `/app/api/ams/rpc/fn_ams_events?p_entity_type=${tipo}&p_entity_id=${recId}&p_limit=12`, fetcher);
  const OP: Record<string, string> = {
    CREATE: "Creación", UPDATE: "Edición", DOC_UPLOAD: "Documento registrado",
    DOC_DELETE: "Documento eliminado", ASSIGN: "Asignación", UNASSIGN: "Desasignación",
  };
  return (
    <Panel className="lg:col-span-2" titulo="Historial de cambios">
      {data?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="py-1.5 pr-4 font-medium">Operación</th>
                <th className="py-1.5 pr-4 font-medium">Realizado por</th>
                <th className="py-1.5 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700/60">
                  <td className="py-1.5 pr-4 text-gray-900 dark:text-white">
                    {OP[e.event_type] ?? e.event_type}</td>
                  <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-300">
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

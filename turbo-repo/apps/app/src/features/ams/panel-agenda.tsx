"use client";

// Capacity C0 · Agenda del recurso — la respuesta a "¿cómo estará el
// martes?": espejo DERIVADO de los servicios del coordinador (nada que
// mantener) + la única declaración manual permitida: bloquear por
// excepción. Principio: derivada, no declarada (capacity-core, 2026-07-24).
import { useState } from "react";
import useSWR from "swr";
import { TextInput } from "flowbite-react";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});
const post = async (fn: string, body: Record<string, unknown>) => {
  const r = await fetch(`/app/api/ams/rpc/${fn}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};

type Compromiso = {
  commitment_id: number; kind: string; ini: number; fin: number;
  ref: string | null; source: string; actor: string | null;
};

const KIND_META: Record<string, { l: string; cls: string; dot: string }> = {
  SERVICIO: { l: "Servicio", dot: "#1C64F2",
    cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  MANTENCION: { l: "Mantención", dot: "#F1B300",
    cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  RESERVA: { l: "Reserva", dot: "#7E3AF2",
    cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  BLOQUEO: { l: "Bloqueo", dot: "#111928",
    cls: "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200" },
  INDISPONIBILIDAD: { l: "No disponible", dot: "#E11D48",
    cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const fmt = (epoch: number) =>
  new Date(epoch * 1000).toLocaleString("es-CL",
    { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtHora = (epoch: number) =>
  new Date(epoch * 1000).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
const mismoDia = (a: number, b: number) =>
  new Date(a * 1000).toDateString() === new Date(b * 1000).toDateString();

const btnSec = "rounded-lg border border-gray-300 dark:border-gray-600 text-xs px-2.5 py-1.5 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700";
const btnPri = "rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50";

/** Agenda del recurso: compromisos derivados + bloqueo por excepción. */
export function PanelAgenda({ tipo, recId }: { tipo: "TRUCK" | "DRIVER"; recId: string }) {
  const { carrierMode } = useCarrierMode();
  const { data, mutate } = useSWR<Compromiso[] | { ok: false }>(
    `/app/api/ams/rpc/fn_cap_agenda?p_resource_type=${tipo}&p_resource_id=${recId}`, fetcher);
  const [bloqueando, setBloqueando] = useState(false);
  const [ini, setIni] = useState(""); const [fin, setFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);

  const compromisos = Array.isArray(data) ? data : [];
  const ahora = Date.now() / 1000;

  const bloquear = async () => {
    if (!ini || !fin) { setMsg("Indica inicio y término."); return; }
    setBusy(true); setMsg(null);
    const { data: res } = await post("fn_cap_block", {
      p_resource_type: tipo, p_resource_id: recId,
      p_ini: new Date(ini).toISOString(), p_fin: new Date(fin).toISOString(),
      p_motivo: motivo, p_actor: "app-agenda",
    });
    setBusy(false);
    if (res?.ok === false) {
      setMsg(res.error === "rango" ? res.detalle : `No bloqueado — ${res.error}`);
      return;
    }
    setBloqueando(false); setIni(""); setFin(""); setMotivo("");
    void mutate();
  };

  const liberar = async (id: number) => {
    if (!window.confirm("¿Quitar esta indisponibilidad?")) return;
    await post("fn_cap_unblock", { p_commitment_id: id, p_actor: "app-agenda" });
    void mutate();
  };

  const refrescar = async () => {
    setBusy(true);
    await post("fn_cap_refresh_agenda", {});
    setBusy(false); void mutate();
  };

  return (
    <div className="flex flex-col gap-2">
      {compromisos.length ? (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {compromisos.map((c) => {
            const meta = KIND_META[c.kind] ?? KIND_META.BLOQUEO;
            const enCurso = c.ini <= ahora && ahora < c.fin;
            return (
              <div key={c.commitment_id} className="flex items-center gap-2.5 py-[7px]">
                <span className="w-2 h-2 rounded-full flex-none" style={{ background: meta.dot }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
                      {meta.l}
                    </span>
                    {enCurso && (
                      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">ahora</span>)}
                    <span className="text-xs text-gray-500 truncate">
                      {c.kind === "SERVICIO" ? `servicio ${c.ref}` : (c.ref ?? "")}
                    </span>
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {fmt(c.ini)} — {mismoDia(c.ini, c.fin) ? fmtHora(c.fin) : fmt(c.fin)}
                  </div>
                </div>
                {c.kind === "INDISPONIBILIDAD" && (
                  <button className="text-[11px] text-rose-600 hover:underline flex-none"
                          onClick={() => void liberar(c.commitment_id)}>
                    quitar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-500 py-1">
          Sin compromisos en la ventana visible — libre hasta donde sabemos.
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
        <button className={btnSec} onClick={() => { setBloqueando(!bloqueando); setMsg(null); }}>
          {bloqueando ? "Cancelar" : "Bloquear período"}
        </button>
        {!carrierMode && (
          <button className={btnSec} disabled={busy} onClick={() => void refrescar()}>
            {busy ? "Sincronizando…" : "Sincronizar servicios"}
          </button>
        )}
        <span className="text-[11px] text-gray-400 flex-1 text-right">
          agenda derivada de la operación
        </span>
      </div>

      {bloqueando && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Desde</span>
            <TextInput sizing="sm" type="datetime-local" value={ini}
                       onChange={(e) => setIni(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Hasta</span>
            <TextInput sizing="sm" type="datetime-local" value={fin}
                       onChange={(e) => setFin(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <span className="text-xs text-gray-500">Motivo</span>
            <TextInput sizing="sm" value={motivo} placeholder="p. ej. mantención externa"
                       onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <button className={btnPri} disabled={busy} onClick={() => void bloquear()}>
            {busy ? "Bloqueando…" : "Bloquear"}
          </button>
        </div>
      )}
      {msg && <div className="text-xs text-red-600 dark:text-red-400">{msg}</div>}
    </div>
  );
}

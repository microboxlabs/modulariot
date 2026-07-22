"use client";

import "@/features/gemelo-common/gemelo.css";

// Nivel 4 ISA-101 — Simulador what-if: cierre de nodo y restricción
// horaria sobre la red logística calibrada. Todo resultado se etiqueta
// como SIMULACIÓN (fidelidad declarada) — nunca se confunde con lo real.
import { useState } from "react";
import useSWR from "swr";
import { golFetcher as fetcher, golPost } from "@/features/gemelo-common/fetcher";
import Link from "next/link";

type Nodo = { nodo_id: number; nombre: string; tramos: number; en_rutas: number };

type Resultado = {
  escenario_id: number;
  tipo: string;
  nodo: string;
  ventana: { desde: string; hasta: string };
  afectados: number;
  nota: string;
  resultados: {
    service_id: string;
    delta_eta_min: number;
    risk_actual: number;
    risk_proyectado: number;
    truck: string | null;
    destino: string | null;
    acciones: string[];
  }[];
};

export function Simulador() {
  const { data: nodos } = useSWR<Nodo[]>("/rpc/fn_dx_gol_nodos", fetcher);
  const [tipo, setTipo] = useState<"cierre_nodo" | "restriccion_horaria">("cierre_nodo");
  const [nodoId, setNodoId] = useState<number | null>(null);
  const [horas, setHoras] = useState(24);
  const [horaIni, setHoraIni] = useState("08:00");
  const [horaFin, setHoraFin] = useState("18:00");
  const [corriendo, setCorriendo] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simular() {
    if (!nodoId) return;
    setCorriendo(true);
    setError(null);
    try {
      const r = await golPost("fn_dx_gol_simular", {
          p_tipo: tipo,
          p_nodo_id: nodoId,
          p_horas: horas,
          p_hora_ini: tipo === "restriccion_horaria" ? horaIni : null,
          p_hora_fin: tipo === "restriccion_horaria" ? horaFin : null,
        });
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      setRes(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCorriendo(false);
    }
  }

  const selectStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 14,
    color: "var(--foreground)",
  } as const;

  return (
    <div className="gemelo-scope h-full w-full overflow-y-auto"><div className="p-4 space-y-4 max-w-[1440px] mx-auto">
      <div className="flex items-center gap-3">
        <h2 className="text-[18px] font-semibold">Simulador de escenarios</h2>
        <span className="badge badge-warning">
          <span className="dot dot-warning" />
          Simulación
        </span>
      </div>

      <section className="card px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1">
            <div className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Escenario</div>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} style={selectStyle}>
              <option value="cierre_nodo">Cierre de nodo</option>
              <option value="restriccion_horaria">Restricción horaria</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Nodo de la red</div>
            <select
              value={nodoId ?? ""}
              onChange={(e) => setNodoId(Number(e.target.value) || null)}
              style={{ ...selectStyle, maxWidth: 320 }}
            >
              <option value="">Seleccionar nodo</option>
              {(nodos ?? []).filter((n) => n.en_rutas > 0).map((n) => (
                <option key={n.nodo_id} value={n.nodo_id}>
                  {n.nombre} ({n.en_rutas} rutas)
                </option>
              ))}
            </select>
          </label>
          {tipo === "cierre_nodo" ? (
            <label className="space-y-1">
              <div className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Duración (horas)</div>
              <input type="number" min={1} max={96} value={horas}
                     onChange={(e) => setHoras(Number(e.target.value))} style={{ ...selectStyle, width: 90 }} />
            </label>
          ) : (
            <>
              <label className="space-y-1">
                <div className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Desde</div>
                <input type="time" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} style={selectStyle} />
              </label>
              <label className="space-y-1">
                <div className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Hasta</div>
                <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} style={selectStyle} />
              </label>
            </>
          )}
          <button
            onClick={simular}
            disabled={!nodoId || corriendo}
            className="px-4 py-2 rounded-lg text-[14px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--blue-600)" }}
          >
            {corriendo ? "Simulando" : "Simular"}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-[13px]" style={{ color: "var(--rose-600)" }}>{error}</div>
        )}
      </section>

      {res && (
        <section className="card overflow-x-auto">
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="font-semibold text-[14px]">
              {res.nodo} · {res.afectados} servicio{res.afectados === 1 ? "" : "s"} afectado{res.afectados === 1 ? "" : "s"}
            </div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>{res.nota}</div>
          </div>
          {res.resultados.length === 0 && (
            <div className="px-5 py-6 text-[13px]" style={{ color: "var(--muted)" }}>
              Ningún servicio activo pasa por este nodo dentro de la ventana simulada
            </div>
          )}
          {res.resultados.length > 0 && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  <th className="px-5 py-2 font-medium">Servicio</th>
                  <th className="px-2 py-2 font-medium">Camión</th>
                  <th className="px-2 py-2 font-medium">Destino</th>
                  <th className="px-2 py-2 font-medium">Δ ETA</th>
                  <th className="px-2 py-2 font-medium">Riesgo actual → proyectado</th>
                  <th className="px-5 py-2 font-medium">Acción sugerida</th>
                </tr>
              </thead>
              <tbody>
                {res.resultados.map((r) => (
                  <tr key={r.service_id} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-2 font-medium">
                      <Link href={`/servicio/${r.service_id}`} className="hover:underline" style={{ color: "var(--blue-600)" }}>
                        {r.service_id}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{r.truck ?? "—"}</td>
                    <td className="px-2 py-2">{r.destino ?? "—"}</td>
                    <td className="px-2 py-2 font-medium">
                      {r.delta_eta_min > 0 ? `+${Math.round(r.delta_eta_min)} min` : "sin impacto"}
                    </td>
                    <td className="px-2 py-2">
                      {r.risk_actual} → <span className="font-medium">{r.risk_proyectado}</span>
                    </td>
                    <td className="px-5 py-2 text-[12px]" style={{ color: "var(--muted)" }}>
                      {r.acciones[1] ?? r.acciones[0]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div></div>
  );
}

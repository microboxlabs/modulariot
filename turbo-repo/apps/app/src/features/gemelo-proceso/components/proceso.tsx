"use client";

import "@/features/gemelo-common/gemelo.css";

// Gemelo del PROCESO (P1) — la foto del flujo: kanban agregado de toda la
// flota por etapa BPM, con envejecimiento vs histórico (p50/p90 de la propia
// etapa), throughput 24h y drill-down a los servicios de cada etapa.
import { useState } from "react";
import useSWR from "swr";
import { golFetcher as fetcher } from "@/features/gemelo-common/fetcher";

type Etapa = {
  etapa_id: number; etapa: string; estado: string;
  vivos: number; criticos: number; sobre_p50: number; sobre_p90: number;
  edad_p50_h: number | null; hist_p50_h: number | null; hist_p90_h: number | null;
  entradas_24h: number; salidas_24h: number;
};

type ServicioEtapa = {
  service_id: string; camion: string | null; carrier: string | null; ruta: string;
  horas_en_etapa: number; es_critico: boolean; eta_clasificacion: string | null;
};

const fmtH = (h: number | null | undefined) => {
  if (h == null) return "—";
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} d`;
};

export function Proceso() {
  const [fRuta, setFRuta] = useState("");
  const [fCarrier, setFCarrier] = useState("");
  const [etapaSel, setEtapaSel] = useState<number | null>(null);
  const [wiModo, setWiModo] = useState<"demora" | "capacidad" | "automatizar" | "regresiones" | "validacion">("demora");
  const [wiEtapa, setWiEtapa] = useState<number | null>(null);
  const [wiDemoraMin, setWiDemoraMin] = useState(0);
  const [wiFactor, setWiFactor] = useState(1);
  const [wiRedPct, setWiRedPct] = useState(50);
  const [wiValTipo, setWiValTipo] = useState("Somnolencia");

  const { data: filtros } = useSWR<{ rutas: string[] | null; carriers: string[] | null }>(
    "/rpc/fn_dx_gol_proceso_filtros", fetcher);

  const [ro, rd] = fRuta ? fRuta.split("|") : [null, null];
  const qs = new URLSearchParams();
  if (ro) qs.set("p_ruta_origen", ro);
  if (rd) qs.set("p_ruta_destino", rd);
  if (fCarrier) qs.set("p_carrier", fCarrier);
  const sufijo = qs.toString() ? `?${qs.toString()}` : "";

  const { data: etapas } = useSWR<Etapa[]>(
    `/rpc/fn_dx_gol_proceso_flujo${sufijo}`, fetcher, { refreshInterval: 60_000 });

  const { data: comp } = useSWR<{
    validaciones: { tipo: string; valor: string; n: number; avanzados_sin_aprobar: number }[];
    eta: { embudo: { clase: string; n: number }[]; deriva: { con_eta: number; con_cambios: number; deriva_prom_h: number | null } };
    carga: { en_transporte: number; transporte_sin_carga: number; asociaciones_activas: number; desasociadas: number; viajes_con_desasociacion: number };
  }>(`/rpc/fn_dx_gol_proceso_complementos${sufijo}`, fetcher, { refreshInterval: 120_000 });

  const { data: wiBase } = useSWR<{ service_id: string; etapa_actual: number; horas_para_eta: number }[]>(
    `/rpc/fn_dx_gol_proceso_whatif_base${sufijo}`, fetcher, { refreshInterval: 120_000 });

  const { data: avanzado } = useSWR<{
    regresiones: { etapa_id: number; n: number; horas_retrabajo: number }[];
    validacion_bloqueante: { tipo: string; retenidos: number; sintomas_fatiga: number }[];
  }>(`/rpc/fn_dx_gol_proceso_avanzado${sufijo}`, fetcher, { refreshInterval: 120_000 });

  const { data: servicios } = useSWR<ServicioEtapa[]>(
    etapaSel != null
      ? `/rpc/fn_dx_gol_proceso_servicios?p_etapa_id=${etapaSel}${qs.toString() ? "&" + qs.toString() : ""}`
      : null,
    fetcher);

  const totalVivos = (etapas ?? []).reduce((a, e) => a + e.vivos, 0);

  // Lente what-if: demora +X min en la etapa elegida
  // · ETAs perdidas: servicios con ETA vigente que aún deben PASAR por la
  //   etapa (etapa_actual <= elegida) y cuyo margen es menor que la demora
  // · Backlog: con la demora, la etapa procesa más lento (p50/(p50+X));
  //   proyección de WIP a 24h con las tasas reales de entrada/salida
  const whatif = (() => {
    if (!wiEtapa || !wiDemoraMin || !etapas || !wiBase) return null;
    const demoraH = wiDemoraMin / 60;
    const vigentes = wiBase.filter((s) => s.etapa_actual <= wiEtapa);
    const perdidas = vigentes.filter((s) => s.horas_para_eta < demoraH);
    const e = etapas.find((x) => x.etapa_id === wiEtapa);
    let backlog = null;
    if (e && e.hist_p50_h != null && e.hist_p50_h > 0) {
      const factor = e.hist_p50_h / (e.hist_p50_h + demoraH);
      const salidasNuevas = e.salidas_24h * factor;
      backlog = {
        wipActual: e.vivos,
        wip24h: Math.max(0, Math.round(e.vivos + e.entradas_24h - salidasNuevas)),
        salidasantes: e.salidas_24h,
        salidasDespues: Math.round(salidasNuevas),
      };
    }
    return { vigentes: vigentes.length, perdidas: perdidas.length, backlog, etapa: e?.etapa ?? "" };
  })();

  // Lente capacidad: la etapa atiende a ×factor; WIP a 24h y tiempo de
  // ciclo por Little (WIP / salidas por día)
  const wiCap = (() => {
    if (!wiEtapa || wiFactor === 1 || !etapas) return null;
    const e = etapas.find((x) => x.etapa_id === wiEtapa);
    if (!e || e.salidas_24h === 0) return null;
    const salidasNuevas = e.salidas_24h * wiFactor;
    return {
      etapa: e.etapa,
      wipActual: e.vivos,
      wip24h: Math.max(0, Math.round(e.vivos + e.entradas_24h - salidasNuevas)),
      cicloAntes: e.vivos / e.salidas_24h,
      cicloDespues: Math.max(0, e.vivos + e.entradas_24h - salidasNuevas) / salidasNuevas,
      salidasAntes: e.salidas_24h,
      salidasDespues: Math.round(salidasNuevas),
    };
  })();

  // Lente automatizar: la etapa pasa a duración ~0; efecto sobre el lead
  // time histórico (suma de p50 de las etapas del flujo) + WIP liberado
  const wiAuto = (() => {
    if (!wiEtapa || !etapas) return null;
    const e = etapas.find((x) => x.etapa_id === wiEtapa);
    if (!e || e.hist_p50_h == null) return null;
    const leadHist = etapas.reduce((a, x) => a + (x.hist_p50_h ?? 0), 0);
    return {
      etapa: e.etapa, leadHist, leadNuevo: leadHist - e.hist_p50_h,
      pct: Math.round((100 * e.hist_p50_h) / leadHist), liberados: e.vivos,
    };
  })();

  // Lente regresiones: retrabajo real de 30 días (dx_task_timeline) −X%
  const wiReg = (() => {
    if (!avanzado?.regresiones?.length) return null;
    const tot = avanzado.regresiones.reduce(
      (a, r) => ({ n: a.n + r.n, h: a.h + r.horas_retrabajo }), { n: 0, h: 0 });
    const top = avanzado.regresiones[0];
    const topEtapa = (etapas ?? []).find((x) => x.etapa_id === top.etapa_id)?.etapa ?? `etapa ${top.etapa_id}`;
    return { ...tot, hDevueltas: (tot.h * wiRedPct) / 100, top, topEtapa };
  })();

  // Lente validación bloqueante: qué pasa si la validación elegida es
  // requisito para iniciar viaje — retenidos hoy + fatiga que generaron
  const wiVal = avanzado?.validacion_bloqueante?.find((v) => v.tipo === wiValTipo) ?? null;
  const sel = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "var(--foreground)",
  } as const;

  return (
    <div className="gemelo-scope h-full w-full overflow-y-auto"><div className="p-4 space-y-4 max-w-[1440px] mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-[18px] font-semibold">Gemelo del proceso</h2>
        <span className="text-[13px]" style={{ color: "var(--muted)" }}>
          Flujo BPM agregado · envejecimiento vs histórico de cada etapa
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select value={fRuta} onChange={(e) => setFRuta(e.target.value)} style={sel}>
          <option value="">Ruta (todas)</option>
          {(filtros?.rutas ?? []).map((r) => (
            <option key={r} value={r}>{r.replace("|", " → ")}</option>
          ))}
        </select>
        <select value={fCarrier} onChange={(e) => setFCarrier(e.target.value)} style={sel}>
          <option value="">Transportista (todos)</option>
          {(filtros?.carriers ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
          Verde: dentro del p50 histórico · ámbar: sobre p50 · rosa: sobre p90
        </span>
      </div>

      {/* Kanban agregado */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {(etapas ?? []).filter((e) => e.vivos > 0 || e.hist_p50_h != null).map((e) => {
          const ok = e.vivos - e.sobre_p50;
          const warn = e.sobre_p50 - e.sobre_p90;
          const crit = e.sobre_p90;
          return (
            <button
              key={e.etapa_id}
              onClick={() => setEtapaSel(etapaSel === e.etapa_id ? null : e.etapa_id)}
              className="card flex-none w-[210px] px-4 py-3 text-left space-y-2"
              style={etapaSel === e.etapa_id ? { borderColor: "var(--blue-600)" } : undefined}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide leading-tight" style={{ color: "var(--muted)" }}>
                {e.etapa_id} · {e.etapa}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-semibold">{e.vivos}</span>
                {e.criticos > 0 && <span className="counter-red" title="servicios críticos">{e.criticos}</span>}
              </div>
              {e.vivos > 0 && (
                <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gray-100)" }}>
                  {ok > 0 && <span style={{ width: `${(100 * ok) / e.vivos}%`, background: "var(--green-500)" }} />}
                  {warn > 0 && <span style={{ width: `${(100 * warn) / e.vivos}%`, background: "var(--amber-500)" }} />}
                  {crit > 0 && <span style={{ width: `${(100 * crit) / e.vivos}%`, background: "var(--rose-600)" }} />}
                </div>
              )}
              <div className="text-[11px] space-y-0.5" style={{ color: "var(--muted)" }}>
                <div>edad p50: <span className="font-semibold" style={{
                  color: e.edad_p50_h != null && e.hist_p90_h != null && e.edad_p50_h > e.hist_p90_h
                    ? "var(--rose-600)"
                    : e.edad_p50_h != null && e.hist_p50_h != null && e.edad_p50_h > e.hist_p50_h
                      ? "var(--amber-600)" : "var(--green-500)",
                }}>{fmtH(e.edad_p50_h)}</span> · hist {fmtH(e.hist_p50_h)}/{fmtH(e.hist_p90_h)}</div>
                <div>24h: {e.entradas_24h} entran · {e.salidas_24h} salen</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* P3+P4 · What-if de proceso: escenarios componibles con los filtros */}
      <section className="card px-5 py-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap text-[13px]">
          <span className="font-semibold">What-if</span>
          {([
            ["demora", "Demora en etapa"],
            ["capacidad", "Capacidad de etapa"],
            ["automatizar", "Automatizar etapa"],
            ["regresiones", "Reducir regresiones"],
            ["validacion", "Validación bloqueante"],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setWiModo(k)}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium"
              style={wiModo === k
                ? { background: "var(--blue-600)", color: "#fff" }
                : { background: "var(--gray-100)", color: "var(--muted)" }}>
              {label}
            </button>
          ))}
        </div>

        {(wiModo === "demora" || wiModo === "capacidad" || wiModo === "automatizar") && (
          <div className="flex items-center gap-3 flex-wrap text-[13px]">
            <select value={wiEtapa ?? ""} onChange={(e) => setWiEtapa(Number(e.target.value) || null)} style={sel}>
              <option value="">Elegir etapa</option>
              {(etapas ?? []).map((e) => (
                <option key={e.etapa_id} value={e.etapa_id}>{e.etapa_id} · {e.etapa}{e.vivos ? ` (${e.vivos})` : ""}</option>
              ))}
            </select>

            {wiModo === "demora" && (<>
              <input type="range" min={0} max={240} step={15} value={wiDemoraMin}
                     onChange={(e) => setWiDemoraMin(Number(e.target.value))} style={{ width: 140 }} />
              <span className="font-semibold" style={{ color: wiDemoraMin ? "var(--rose-600)" : "var(--muted)" }}>
                +{wiDemoraMin} min
              </span>
              {whatif && (
                <span style={{ color: "var(--muted)" }}>
                  → ETAs vigentes que se pierden:{" "}
                  <span className="font-semibold" style={{ color: whatif.perdidas ? "var(--rose-600)" : "var(--green-500)" }}>
                    {whatif.perdidas}/{whatif.vigentes}
                  </span>
                  {whatif.backlog && (
                    <> · backlog de "{whatif.etapa}" a 24h:{" "}
                      <span className="font-semibold" style={{ color: whatif.backlog.wip24h > whatif.backlog.wipActual ? "var(--amber-600)" : "var(--green-500)" }}>
                        {whatif.backlog.wipActual} → {whatif.backlog.wip24h}
                      </span>
                      {" "}(salidas {whatif.backlog.salidasantes} → {whatif.backlog.salidasDespues}/día)
                    </>
                  )}
                </span>
              )}
            </>)}

            {wiModo === "capacidad" && (<>
              <input type="range" min={0.25} max={3} step={0.25} value={wiFactor}
                     onChange={(e) => setWiFactor(Number(e.target.value))} style={{ width: 140 }} />
              <span className="font-semibold" style={{ color: wiFactor === 1 ? "var(--muted)" : wiFactor > 1 ? "var(--green-500)" : "var(--rose-600)" }}>
                ×{wiFactor}
              </span>
              {wiCap && (
                <span style={{ color: "var(--muted)" }}>
                  → backlog de "{wiCap.etapa}" a 24h:{" "}
                  <span className="font-semibold" style={{ color: wiCap.wip24h > wiCap.wipActual ? "var(--amber-600)" : "var(--green-500)" }}>
                    {wiCap.wipActual} → {wiCap.wip24h}
                  </span>
                  {" "}· tiempo de ciclo: <span className="font-semibold">{wiCap.cicloAntes.toFixed(1)} → {wiCap.cicloDespues.toFixed(1)} días</span>
                  {" "}(salidas {wiCap.salidasAntes} → {wiCap.salidasDespues}/día)
                </span>
              )}
              {wiEtapa != null && wiFactor !== 1 && !wiCap && (
                <span style={{ color: "var(--muted)" }}>la etapa no registra salidas en 24h — sin base para proyectar</span>
              )}
            </>)}

            {wiModo === "automatizar" && (wiAuto ? (
              <span style={{ color: "var(--muted)" }}>
                → si "{wiAuto.etapa}" fuera instantánea (automatización), el lead time histórico del flujo baja{" "}
                <span className="font-semibold" style={{ color: "var(--green-500)" }}>
                  {fmtH(wiAuto.leadHist)} → {fmtH(wiAuto.leadNuevo)} (−{wiAuto.pct}%)
                </span>
                {" "}y libera de inmediato <span className="font-semibold">{wiAuto.liberados}</span> servicios en cola
              </span>
            ) : wiEtapa != null ? (
              <span style={{ color: "var(--muted)" }}>sin p50 histórico para esta etapa</span>
            ) : null)}
          </div>
        )}

        {wiModo === "regresiones" && (
          <div className="flex items-center gap-3 flex-wrap text-[13px]">
            <input type="range" min={0} max={100} step={10} value={wiRedPct}
                   onChange={(e) => setWiRedPct(Number(e.target.value))} style={{ width: 140 }} />
            <span className="font-semibold" style={{ color: "var(--green-500)" }}>−{wiRedPct}%</span>
            {wiReg && (
              <span style={{ color: "var(--muted)" }}>
                → hoy: <span className="font-semibold">{wiReg.n} regresiones</span> devolvieron servicios a etapas previas
                en 30 días, {fmtH(wiReg.h)} de retrabajo (la peor: "{wiReg.topEtapa}" con {fmtH(wiReg.top.horas_retrabajo)}).
                Reducirlas −{wiRedPct}% recupera{" "}
                <span className="font-semibold" style={{ color: "var(--green-500)" }}>{fmtH(wiReg.hDevueltas)}</span> de flujo al mes
              </span>
            )}
          </div>
        )}

        {wiModo === "validacion" && (
          <div className="flex items-center gap-3 flex-wrap text-[13px]">
            <select value={wiValTipo} onChange={(e) => setWiValTipo(e.target.value)} style={sel}>
              {(avanzado?.validacion_bloqueante ?? []).map((v) => (
                <option key={v.tipo} value={v.tipo}>{v.tipo}</option>
              ))}
            </select>
            {wiVal && (
              <span style={{ color: "var(--muted)" }}>
                → si "{wiVal.tipo}" aprobada fuera requisito para iniciar viaje, hoy habrían quedado retenidos{" "}
                <span className="font-semibold" style={{ color: "var(--amber-600)" }}>{wiVal.retenidos}</span> servicios
                que están en ruta sin aprobarla — y que generaron{" "}
                <span className="font-semibold" style={{ color: "var(--rose-600)" }}>{wiVal.sintomas_fatiga}</span> síntomas
                de fatiga/conducción en 7 días: el riesgo que la barrera habría contenido
              </span>
            )}
          </div>
        )}

        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          {wiModo === "demora" && "Simulación — supuestos: la demora afecta a todo servicio que aún debe pasar por la etapa; el backlog usa las tasas reales de entrada/salida de las últimas 24h con capacidad reducida en p50/(p50+demora)"}
          {wiModo === "capacidad" && "Simulación — supuestos: entradas constantes (tasa real 24h), salidas escaladas por el factor; tiempo de ciclo por ley de Little (WIP / salidas por día)"}
          {wiModo === "automatizar" && "Simulación — supuestos: lead time = suma de p50 históricos de las etapas del flujo; automatizar lleva la duración de la etapa a ~0 sin alterar las demás"}
          {wiModo === "regresiones" && "Datos reales — regresiones detectadas en dx_task_timeline (30 días, con los filtros aplicados); la reducción es proporcional sobre las horas de retrabajo medidas"}
          {wiModo === "validacion" && "Datos reales — servicios vivos en etapas de transporte (7-10) sin la validación aprobada, cruzados con sus síntomas de fatiga/conducción de los últimos 7 días"}
        </div>
      </section>

      {/* Drill-down: servicios de la etapa seleccionada */}
      {etapaSel != null && (
        <section className="card overflow-x-auto">
          <div className="px-5 py-3 border-b font-semibold text-[14px]" style={{ borderColor: "var(--border)" }}>
            Servicios más antiguos en "{(etapas ?? []).find((e) => e.etapa_id === etapaSel)?.etapa}"
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                <th className="px-5 py-2 font-medium">Servicio</th>
                <th className="px-2 py-2 font-medium">Camión</th>
                <th className="px-2 py-2 font-medium">Transportista</th>
                <th className="px-2 py-2 font-medium">Ruta</th>
                <th className="px-2 py-2 font-medium">En etapa</th>
                <th className="px-5 py-2 font-medium">ETA</th>
              </tr>
            </thead>
            <tbody>
              {(servicios ?? []).map((s) => (
                <tr key={s.service_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-2 font-medium">
                    <span className="font-medium">{s.service_id}</span>
                    {s.es_critico && <span className="badge badge-critical ml-2">crítico</span>}
                  </td>
                  <td className="px-2 py-2">{s.camion ?? "—"}</td>
                  <td className="px-2 py-2">{s.carrier ?? "—"}</td>
                  <td className="px-2 py-2">{s.ruta}</td>
                  <td className="px-2 py-2 font-semibold">{fmtH(s.horas_en_etapa)}</td>
                  <td className="px-5 py-2">{s.eta_clasificacion ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {/* P2 · Complementos del proceso — misma solución, mismos filtros */}
      {comp && (
        <section className="grid lg:grid-cols-3 gap-4 items-start">
          <div className="card">
            <div className="px-4 py-3 border-b font-semibold text-[14px]" style={{ borderColor: "var(--border)" }}>
              Validaciones
              <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--muted)" }}>rosa = avanzó a transporte sin aprobar</span>
            </div>
            <div className="px-4 py-3 space-y-1.5 text-[12px]">
              {["Alcohol", "Drogas", "Somnolencia", "App conductor", "Huella", "GPS activo"].map((tipo) => {
                const filas = comp.validaciones.filter((v) => v.tipo === tipo);
                const total = filas.reduce((a, b) => a + b.n, 0);
                const aprobado = filas.find((v) => v.valor === "aprobado")?.n ?? 0;
                const sinAprobar = filas.reduce((a, b) => a + b.avanzados_sin_aprobar, 0);
                return (
                  <div key={tipo} className="flex items-center justify-between gap-2">
                    <span>{tipo}</span>
                    <span style={{ color: "var(--muted)" }}>
                      {aprobado}/{total} aprobadas
                      {sinAprobar > 0 && (
                        <span className="font-semibold ml-1" style={{ color: "var(--rose-600)" }}>
                          · {sinAprobar} en ruta sin aprobar
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="px-4 py-3 border-b font-semibold text-[14px]" style={{ borderColor: "var(--border)" }}>
              Foco ETA <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--muted)" }}>embudo del universo vivo</span>
            </div>
            <div className="px-4 py-3 space-y-1.5 text-[12px]">
              {comp.eta.embudo.map((e) => (
                <div key={e.clase} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="dot" style={{ background:
                      e.clase === "cumplida" ? "var(--green-500)" :
                      e.clase === "en_riesgo" ? "var(--amber-500)" :
                      e.clase === "vencida" ? "var(--rose-600)" : "var(--gray-500)" }} />
                    {e.clase.replace("_", " ")}
                  </span>
                  <span className="font-semibold">{e.n}</span>
                </div>
              ))}
              <div className="pt-1 border-t text-[11px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                Nacimiento y deriva de ETA por etapa: sin datos — `eta_en_tarea` viene vacío
                desde el precálculo de prod (mejora identificada para el equipo)
              </div>
            </div>
          </div>

          <div className="card">
            <div className="px-4 py-3 border-b font-semibold text-[14px]" style={{ borderColor: "var(--border)" }}>
              Carga ↔ viaje
            </div>
            <div className="px-4 py-3 space-y-1.5 text-[12px]">
              {[
                ["Viajes en transporte (etapas 7-10)", comp.carga.en_transporte, null],
                ["En transporte SIN carga asociada", comp.carga.transporte_sin_carga,
                 comp.carga.transporte_sin_carga > 0 ? "var(--rose-600)" : "var(--green-500)"],
                ["Asociaciones de carga activas", comp.carga.asociaciones_activas, null],
                ["Desasociaciones registradas", comp.carga.desasociadas, "var(--amber-600)"],
                ["Viajes con alguna desasociación", comp.carga.viajes_con_desasociacion, null],
              ].map(([k, v, c]) => (
                <div key={k as string} className="flex items-center justify-between">
                  <span style={{ color: "var(--muted)" }}>{k}</span>
                  <span className="font-semibold" style={c ? { color: c as string } : undefined}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div></div>
  );
}

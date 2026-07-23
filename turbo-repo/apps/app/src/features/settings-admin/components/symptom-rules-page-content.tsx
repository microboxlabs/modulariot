"use client";

// PT4-a · Settings › Reglas de síntomas — el mantenedor F4 portado del
// laboratorio al patrón del app (mockup validado = contrato: tabs Esquema /
// Catálogo / Auditoría; constructor y clonado llegan en PT4-b).
// Torre: enciende/apaga cajas del catálogo global (con barra de pendientes).
// Carrier: catálogo global READ-ONLY (§C.1) + su cuota visible (75 activas).
// El tenant JAMÁS viaja desde el cliente: lo inyecta /api/atc/rpc/*.
import { useMemo, useState } from "react";
import useSWR from "swr";
import { HiAdjustments } from "react-icons/hi";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

type Nivel = { name: string; color: string; level: string; treatment: string | null };
type Caja = {
  name: string; slug: string; active: boolean; levels: Nivel[] | null;
  rule_id: number | null; operable: boolean; base_type: string; fired_24h: number;
  cost_monthly_usd: number | null;
};
type Familia = { key: string; ord: number; name: string; color: string; items: Caja[] };
type Catalogo = {
  families: Familia[]; custom: Caja[] | null;
  summary: { activas: number; costo_activas: number };
};
type EsquemaNivel = {
  level_key: string; ord: number; display_name: string; color: string;
  description: string; floor_channels: string[]; operator_required: boolean;
  producible: boolean;
};
type AuditRow = {
  id: number; regla: string; operation: string; changed_by: string;
  changed_at: string; reason: string | null;
  new_state: Record<string, unknown> | null;
};
type Combo = {
  level_key: string; display_name: string; color: string; ord: number;
  floor_channels: string[]; operator_required: boolean;
  enabled: boolean; criteria: Record<string, unknown> | null; treatment_type: string | null;
};
type Detalle = {
  rule_id: number; is_active: boolean; display_name: string | null; name: string;
  description: string | null; base_type: string; cloned_from: number | null;
  org_id: string | null; editable: boolean; combinaciones: Combo[];
};
type MiRegla = { rule_id: number; name: string; active: boolean; niveles: number; cost_monthly_usd: number | null };
type Cuota = { usadas: number; limite: number };
type Cuotas = { reglas: Cuota; lugares: Cuota; trayectos: Cuota };

const TABS = ["catalogo", "constructor", "esquema", "auditoria"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  catalogo: "Catálogo de síntomas", constructor: "Constructor",
  esquema: "Esquema de criticidad", auditoria: "Auditoría",
};

export default function SymptomRulesPageContent() {
  const { carrierMode } = useCarrierMode();
  const [tab, setTab] = useState<Tab>("catalogo");
  const [busca, setBusca] = useState("");
  // Cambios pendientes (torre): rule_id → active deseado
  const [pendientes, setPendientes] = useState<Record<number, boolean>>({});
  const [aplicando, setAplicando] = useState(false);
  const [reglaSel, setReglaSel] = useState<number | null>(null);
  const [fanout, setFanout] = useState<Record<string, unknown> | null>(null);
  const [msgCons, setMsgCons] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const { data: cat, mutate: refrescar } = useSWR<Catalogo>(
    "/app/api/atc/rpc/fn_symptom_list?p_org_id=org_demo", fetcher);
  const { data: esquema } = useSWR<EsquemaNivel[]>(
    tab === "esquema" ? "/app/api/atc/rpc/fn_pt4_criticality_scheme" : null, fetcher);
  const { data: audit } = useSWR<AuditRow[]>(
    tab === "auditoria" ? "/app/api/atc/rpc/fn_pt4_audit_log" : null, fetcher);
  const { data: cuotas } = useSWR<Cuotas>(
    carrierMode ? "/app/api/atc/rpc/fn_pt4_quota_status" : null, fetcher);
  const { data: mias, mutate: refrescarMias } = useSWR<{ reglas: MiRegla[]; cuota: Cuota }>(
    carrierMode ? "/app/api/atc/rpc/fn_pt4_my_rules" : null, fetcher);
  const { data: det, mutate: refrescarDet } = useSWR<Detalle>(
    tab === "constructor" && reglaSel != null
      ? `/app/api/atc/rpc/fn_pt4_rule_detail?p_rule_id=${reglaSel}` : null, fetcher);

  const familias = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const fams = [...(cat?.families ?? [])].sort((a, b) => a.ord - b.ord);
    if (!q) return fams;
    return fams
      .map((f) => ({ ...f, items: f.items.filter((c) => c.name.toLowerCase().includes(q)) }))
      .filter((f) => f.items.length > 0);
  }, [cat, busca]);

  const nPend = Object.keys(pendientes).length;

  const aplicar = async () => {
    setAplicando(true); setResultado(null);
    try {
      const cambios = Object.entries(pendientes).map(([rule_id, active]) => ({
        rule_id: Number(rule_id), active,
      }));
      const res = await fetch("/app/api/atc/rpc/fn_pt4_apply_selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ p_changes: cambios, p_actor: "app-settings" }),
      }).then((r) => r.json());
      if (res?.ok) {
        setResultado(`Aplicado: ${res.changed} cambio(s) · costo activo US$ ${Number(res.active_cost_monthly_usd ?? 0).toLocaleString()}/mes`);
        setPendientes({});
        void refrescar();
      } else {
        setResultado(`No aplicado — ${res?.detalle ?? res?.error ?? "error desconocido"}`);
      }
    } catch {
      setResultado("No aplicado — error de conexión con el laboratorio (:3011)");
    } finally {
      setAplicando(false);
    }
  };

  const estadoDe = (c: Caja) => (c.rule_id != null ? pendientes[c.rule_id] : undefined) ?? c.active;

  const post = (fn: string, body: Record<string, unknown>) =>
    fetch(`/app/api/atc/rpc/${fn}`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }).then((r) => r.json());

  const clonar = async (ruleId: number, nombre: string) => {
    const res = await post("fn_pt4_clone_rule", {
      p_rule_id: ruleId, p_new_name: `${nombre} — copia`, p_actor: "app-settings" });
    if (res?.ok) {
      setReglaSel(Number(res.rule_id ?? res.new_rule_id));
      setTab("constructor"); setFanout(null); setMsgCons("Clon creado (apagado). Ajusta sus niveles y actívalo cuando esté listo.");
      void refrescarMias();
    } else setMsgCons(`No se pudo clonar — ${res?.detalle ?? res?.error ?? "error"}`);
  };

  const guardarCombo = async (cb: Combo, enabled: boolean, treatment: string | null) => {
    const res = await post("fn_pt4_save_combination", {
      p_rule_id: reglaSel, p_level_key: cb.level_key, p_enabled: enabled,
      p_criteria: cb.criteria, p_treatment: treatment, p_actor: "app-settings" });
    setMsgCons(res?.ok === false ? `No guardado — ${res?.detalle ?? res?.error}` : "Combinación guardada (auditada).");
    void refrescarDet(); void refrescar();
  };

  const estimar = async () => {
    setFanout(await post("fn_pt4_estimate", { p_rule_id: reglaSel }));
  };

  const activarRegla = async (r: MiRegla) => {
    const res = await post("fn_pt4_apply_selection", {
      p_changes: [{ rule_id: r.rule_id, active: !r.active }], p_actor: "app-settings" });
    setMsgCons(res?.ok === false ? `${res?.detalle ?? res?.error}` : null);
    void refrescarMias(); void refrescar();
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-y-auto">
      <div className="flex items-center gap-3">
        <HiAdjustments className="h-6 w-6 text-gray-500 dark:text-gray-400" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Reglas de síntomas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {carrierMode
              ? "Catálogo de la operación (solo lectura). Tus reglas propias se gestionan con plantillas — próximamente el constructor."
              : "Mantenedor del catálogo: qué cajas están encendidas y con qué criticidad. Todo cambio queda auditado."}
          </p>
        </div>
        <span className="flex-1" />
        {cat && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <b className="text-gray-900 dark:text-white">{cat.summary.activas}</b> activas ·
            US$ {Number(cat.summary.costo_activas).toLocaleString()}/mes
          </div>
        )}
      </div>

      {/* Cuotas del tenant — "el límite se muestra en la UI, no se descubre" (§C) */}
      {carrierMode && cuotas && (
        <div className="grid grid-cols-3 gap-3">
          {([["Reglas activas", cuotas.reglas], ["Lugares", cuotas.lugares], ["Trayectos", cuotas.trayectos]] as const)
            .map(([label, q]) => (
            <div key={label} className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {q.usadas} <span className="text-sm font-normal text-gray-500">/ {q.limite}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full"
                     style={{ width: `${Math.min(100, (100 * q.usadas) / q.limite)}%`,
                              background: q.usadas >= q.limite ? "#E11D48" : "#1C64F2" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
                    tab === t
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}>
            {TAB_LABEL[t]}
          </button>
        ))}
        <span className="flex-1" />
        {tab === "catalogo" && (
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Buscar síntoma…"
                 className="mb-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white w-[220px]" />
        )}
      </div>

      {/* ── Catálogo ── */}
      {tab === "catalogo" && (
        <div className="space-y-4 pb-16">
          {carrierMode && mias && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white pb-1.5">
                Tus reglas <span className="text-xs font-normal text-gray-500">
                  {mias.cuota.usadas}/{mias.cuota.limite} activas — clona una caja del catálogo para crear la tuya</span>
              </h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                {mias.reglas.map((r) => (
                  <div key={r.rule_id} className="rounded-lg border border-blue-300 dark:border-blue-800 px-3 py-2.5 flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={r.active}
                             onChange={() => void activarRegla(r)} />
                      <span className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.name}</div>
                      <div className="text-[11px] text-gray-500">{r.niveles} nivel(es)
                        {r.cost_monthly_usd != null && <> · US$ {r.cost_monthly_usd}/mes</>}</div>
                    </div>
                    <button className="text-xs text-blue-600 hover:underline"
                            onClick={() => { setReglaSel(r.rule_id); setFanout(null); setTab("constructor"); }}>
                      editar
                    </button>
                  </div>
                ))}
                {mias.reglas.length === 0 && (
                  <div className="text-sm text-gray-500 md:col-span-2 xl:col-span-3">
                    Aún no tienes reglas propias — usa «clonar» en cualquier caja del catálogo.
                  </div>
                )}
              </div>
            </section>
          )}
          {!cat && <div className="text-sm text-gray-500">Cargando catálogo…</div>}
          {familias.map((f) => (
            <section key={f.key}>
              <div className="flex items-center gap-2 pb-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }} />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{f.name}</h2>
                <span className="text-xs text-gray-500">{f.items.length}</span>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                {f.items.map((c, i) => {
                  const on = estadoDe(c);
                  // Cajas del catálogo comercial sin regla materializada aún
                  // (rule_id nulo): no se pueden operar desde aquí.
                  const operable = !carrierMode && c.operable && c.rule_id != null;
                  const cambiado = c.rule_id != null && c.rule_id in pendientes;
                  return (
                    <div key={c.slug ?? c.rule_id ?? `${f.key}-${i}`}
                         className={`rounded-lg border px-3 py-2.5 flex items-start gap-3 ${
                           cambiado ? "border-blue-500" : "border-gray-200 dark:border-gray-700"}`}>
                      <label className={`relative inline-flex items-center mt-0.5 ${
                        operable ? "cursor-pointer" : "opacity-50"}`}>
                        <input type="checkbox" className="sr-only peer" checked={on}
                               disabled={!operable}
                               onChange={() => setPendientes((p) => {
                                 if (c.rule_id == null) return p;
                                 const id = c.rule_id;
                                 const next = { ...p };
                                 if (id in next) delete next[id];
                                 else next[id] = !c.active;
                                 return next;
                               })} />
                        <span className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</div>
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {(c.levels ?? []).map((n, i) => (
                            <span key={`${n.level ?? n.name ?? "nivel"}-${i}`} title={n.treatment ?? undefined}
                                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                  style={{ background: `${n.color}1A`, color: n.color }}>
                              {n.name}
                            </span>
                          ))}
                          {c.base_type !== "stock" && (
                            <span className="text-[10px] text-gray-500">custom</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 pt-0.5 flex items-center gap-2">
                          <span>{c.fired_24h} disparos 24 h
                            {c.cost_monthly_usd != null && <> · US$ {c.cost_monthly_usd}/mes</>}</span>
                          {c.rule_id != null && (
                            <>
                              <button className="text-blue-600 hover:underline"
                                      onClick={() => { setReglaSel(c.rule_id); setFanout(null); setTab("constructor"); }}>
                                abrir
                              </button>
                              <button className="text-blue-600 hover:underline"
                                      onClick={() => void clonar(c.rule_id!, c.name)}>
                                clonar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {cat && familias.length === 0 && (
            <div className="text-sm text-gray-500">Sin resultados para «{busca}»</div>
          )}
          {resultado && (
            <div className="text-sm text-gray-700 dark:text-gray-300">{resultado}</div>
          )}
        </div>
      )}

      {/* Barra de pendientes (torre): el cambio se aplica auditado */}
      {tab === "catalogo" && !carrierMode && nPend > 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 shadow-xl">
          <span className="text-sm text-gray-900 dark:text-white">
            {nPend} cambio{nPend === 1 ? "" : "s"} pendiente{nPend === 1 ? "" : "s"}
          </span>
          <button onClick={aplicar} disabled={aplicando}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50">
            {aplicando ? "Aplicando…" : "Aplicar"}
          </button>
          <button onClick={() => setPendientes({})}
                  className="text-sm text-gray-500 hover:underline">Descartar</button>
        </div>
      )}

      {/* ── Constructor: combinaciones por nivel + fanout (PT4-b) ── */}
      {tab === "constructor" && (
        <div className="space-y-4 pb-16">
          {reglaSel == null && (
            <div className="text-sm text-gray-500">
              Elige una regla desde el catálogo («abrir») o clona una caja para crear la tuya.
            </div>
          )}
          {reglaSel != null && !det && <div className="text-sm text-gray-500">Cargando regla…</div>}
          {det && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {det.display_name ?? det.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {det.base_type}{det.cloned_from != null && <> · clon de #{det.cloned_from}</>}
                    {det.org_id && <> · org {det.org_id}</>} · {det.is_active ? "encendida" : "apagada"}
                    {!det.editable && " · solo lectura para tu organización"}
                  </div>
                </div>
                <span className="flex-1" />
                <button onClick={() => void estimar()}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
                  Estimar impacto
                </button>
              </div>

              {fanout && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm flex items-center gap-4 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-white">Fanout (dry-run)</span>
                  <span>riesgo: <b style={{ color: String(fanout.risk_level) === "low" ? "#0E9F6E"
                    : String(fanout.risk_level) === "moderate" ? "#D97706"
                    : String(fanout.risk_level) === "unknown" ? "#6B7280" : "#E11D48" }}>
                    {String(fanout.risk_level)}</b></span>
                  <span>{Number(fanout.matches_per_hour ?? 0)} coincidencias/h</span>
                  <span>US$ {Number(fanout.cost_monthly_usd_estimate ?? 0)}/mes estimado</span>
                  {typeof fanout.error === "string" && (
                    <span className="text-gray-500">{fanout.error}</span>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {det.combinaciones.map((cb) => (
                  <ComboFila key={cb.level_key} cb={cb} editable={det.editable}
                             onGuardar={(en, tr) => void guardarCombo(cb, en, tr)} />
                ))}
              </div>
              <p className="text-[11px] text-gray-500">
                Los pisos de notificación del esquema no se pueden rebajar; el código negro
                exige gestión de operador. Cada guardado queda en la auditoría.
              </p>
            </>
          )}
          {msgCons && <div className="text-sm text-gray-700 dark:text-gray-300">{msgCons}</div>}
        </div>
      )}

      {/* ── Esquema de criticidad (constitución, read-only) ── */}
      {tab === "esquema" && (
        <div className="space-y-2 pb-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Los pisos de notificación son mínimos que ninguna combinación puede rebajar
            {carrierMode && " — el esquema lo define la operación, no es configurable por transportista"}.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2.5">Nivel</th>
                  <th className="px-4 py-2.5">Descripción</th>
                  <th className="px-4 py-2.5">Piso de notificación</th>
                  <th className="px-4 py-2.5">Operador</th>
                  <th className="px-4 py-2.5">Producible</th>
                </tr>
              </thead>
              <tbody>
                {(esquema ?? []).map((n) => (
                  <tr key={n.level_key} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: n.color }} />
                        {n.display_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{n.description}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                      {(n.floor_channels ?? []).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-2.5">{n.operator_required ? "Requerido" : "—"}</td>
                    <td className="px-4 py-2.5">{n.producible ? "Sí" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!esquema && <div className="text-sm text-gray-500">Cargando esquema…</div>}
        </div>
      )}

      {/* ── Auditoría ── */}
      {tab === "auditoria" && (
        <div className="space-y-1.5 pb-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Registro append-only: quién cambió qué, cuándo y por qué.
            {carrierMode && " Ves solo la actividad de tu organización."}
          </p>
          {(audit ?? []).map((a) => (
            <div key={a.id} className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-3 text-sm">
              <span className="font-medium text-gray-900 dark:text-white truncate max-w-[280px]">{a.regla}</span>
              <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {a.operation}
              </span>
              {a.new_state && "is_active" in a.new_state && (
                <span className="text-xs" style={{ color: a.new_state.is_active ? "#0E9F6E" : "#E11D48" }}>
                  {a.new_state.is_active ? "encendida" : "apagada"}
                </span>
              )}
              <span className="text-gray-500 dark:text-gray-400 truncate flex-1">{a.reason}</span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {a.changed_by} · {new Date(a.changed_at).toLocaleString("es-CL")}
              </span>
            </div>
          ))}
          {audit && audit.length === 0 && (
            <div className="text-sm text-gray-500">Sin actividad registrada.</div>
          )}
          {!audit && <div className="text-sm text-gray-500">Cargando auditoría…</div>}
        </div>
      )}
    </div>
  );
}

// Fila de combinación del constructor: nivel + tratamiento + guardar.
function ComboFila({ cb, editable, onGuardar }: {
  cb: Combo; editable: boolean;
  onGuardar: (enabled: boolean, treatment: string | null) => void;
}) {
  const [en, setEn] = useState(cb.enabled);
  const [tr, setTr] = useState(cb.treatment_type ?? "registro");
  const cambiado = en !== cb.enabled || tr !== (cb.treatment_type ?? "registro");
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-4 flex-wrap">
      <span className="inline-flex items-center gap-2 w-[180px] font-medium text-sm text-gray-900 dark:text-white">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cb.color }} />
        {cb.display_name}
      </span>
      <label className={`relative inline-flex items-center ${editable ? "cursor-pointer" : "opacity-50"}`}>
        <input type="checkbox" className="sr-only peer" checked={en} disabled={!editable}
               onChange={() => setEn(!en)} />
        <span className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
      </label>
      <select value={tr} disabled={!editable || cb.operator_required}
              onChange={(e) => setTr(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white">
        <option value="registro">Registro</option>
        <option value="notificacion">Notificación</option>
        <option value="gestion_operador">Gestión de operador</option>
      </select>
      <span className="text-[11px] text-gray-500 flex-1">
        piso: {cb.floor_channels.join(", ") || "—"}
        {cb.operator_required && " · operador requerido (no rebajable)"}
      </span>
      {editable && cambiado && (
        <button onClick={() => onGuardar(en, cb.operator_required ? "gestion_operador" : tr)}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5">
          Guardar
        </button>
      )}
    </div>
  );
}

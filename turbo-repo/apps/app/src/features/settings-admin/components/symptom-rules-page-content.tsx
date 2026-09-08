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
import FichaSintoma, { Campo } from "./ficha-sintoma";
import FuentesCondicion from "./fuentes-condicion";
import { TextInput, Select as DsSelect } from "flowbite-react";

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
type MiRegla = { rule_id: number; name: string; active: boolean; niveles: number; cost_monthly_usd: number | null };
type Cuota = { usadas: number; limite: number };
type Cuotas = { reglas: Cuota; lugares: Cuota; trayectos: Cuota };

const TABS = ["catalogo", "constructor", "fuentes", "esquema", "auditoria"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  catalogo: "Catálogo de síntomas", constructor: "Ficha del síntoma",
  fuentes: "Fuentes de condición",
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
  const [slugSel, setSlugSel] = useState<string | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", familia: "", descripcion: "" });
  const [creando, setCreando] = useState(false);
  const [msgCons, setMsgCons] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const { data: cat, mutate: refrescar } = useSWR<Catalogo>(
    "/app/api/atc/rpc/fn_symptom_list?p_org_id=org_demo", fetcher);
  const { data: familiasCat } = useSWR<{ family_key: string; name: string; color: string }[]>(
    nuevoAbierto ? "/app/api/atc/rpc/fn_pt4_familias" : null, fetcher);
  const { data: esquema } = useSWR<EsquemaNivel[]>(
    tab === "esquema" ? "/app/api/atc/rpc/fn_pt4_criticality_scheme" : null, fetcher);
  const { data: audit } = useSWR<AuditRow[]>(
    tab === "auditoria" ? "/app/api/atc/rpc/fn_pt4_audit_log" : null, fetcher);
  const { data: cuotas } = useSWR<Cuotas>(
    carrierMode ? "/app/api/atc/rpc/fn_pt4_quota_status" : null, fetcher);
  const { data: mias, mutate: refrescarMias } = useSWR<{ reglas: MiRegla[]; cuota: Cuota }>(
    carrierMode ? "/app/api/atc/rpc/fn_pt4_my_rules" : null, fetcher);

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

  const crearSintoma = async () => {
    setCreando(true);
    const res = await post("fn_pt4_create_rule", {
      p_nombre: nuevo.nombre, p_familia: nuevo.familia,
      p_descripcion: nuevo.descripcion || null, p_actor: "app-settings" });
    setCreando(false);
    if (res?.ok) {
      setNuevoAbierto(false);
      setNuevo({ nombre: "", familia: "", descripcion: "" });
      setReglaSel(Number(res.rule_id)); setSlugSel(String(res.slug));
      setTab("constructor");
      setMsgCons("Síntoma creado (apagado). Define su regla del motor, criticidades y automatismos; enciéndelo cuando esté listo.");
      void refrescar();
    } else {
      setResultado(`No creado — ${res?.detalle ?? res?.error ?? "error"}`);
    }
  };

  const clonar = async (ruleId: number, nombre: string) => {
    const res = await post("fn_pt4_clone_rule", {
      p_rule_id: ruleId, p_new_name: `${nombre} — copia`, p_actor: "app-settings" });
    if (res?.ok) {
      setReglaSel(Number(res.rule_id ?? res.new_rule_id)); setSlugSel(null);
      setTab("constructor"); setMsgCons("Clon creado (apagado). Ajusta sus niveles y actívalo cuando esté listo.");
      void refrescarMias();
    } else setMsgCons(`No se pudo clonar — ${res?.detalle ?? res?.error ?? "error"}`);
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
          <div className="flex items-center gap-2 mb-1">
            <TextInput sizing="sm" value={busca} onChange={(e) => setBusca(e.target.value)}
                       aria-label="Buscar síntoma" placeholder="Buscar síntoma…" className="w-[220px]" />
            <button onClick={() => setNuevoAbierto((v) => !v)}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5">
              + Nuevo síntoma
            </button>
          </div>
        )}
      </div>

      {/* ── Catálogo ── */}
      {tab === "catalogo" && (
        <div className="space-y-4 pb-16">
          {nuevoAbierto && (
            <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Nuevo síntoma</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Campo id="ns-nombre" label="Nombre *">
                  <TextInput id="ns-nombre" sizing="sm" value={nuevo.nombre}
                             onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
                </Campo>
                <Campo id="ns-familia" label="Familia *"
                       ayuda="Dónde aparece en el catálogo">
                  <DsSelect id="ns-familia" sizing="sm" value={nuevo.familia}
                            onChange={(e) => setNuevo({ ...nuevo, familia: e.target.value })}>
                    <option value="">— elegir familia —</option>
                    {(familiasCat ?? []).map((f) => (
                      <option key={f.family_key} value={f.family_key}>{f.name}</option>
                    ))}
                  </DsSelect>
                </Campo>
                <Campo id="ns-descr" label="Descripción">
                  <TextInput id="ns-descr" sizing="sm" value={nuevo.descripcion}
                             onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} />
                </Campo>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Se crea apagado, con un matcher mínimo por definir — al crearlo se abre su ficha
                para configurar la regla del motor, las criticidades y los automatismos.
              </p>
              <div className="flex gap-2">
                <button disabled={creando || !nuevo.nombre.trim() || !nuevo.familia}
                        onClick={() => void crearSintoma()}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50">
                  {creando ? "Creando…" : "Crear y abrir ficha"}
                </button>
                <button onClick={() => setNuevoAbierto(false)}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 text-sm px-3 py-1.5 text-gray-900 dark:text-white">
                  Cancelar
                </button>
              </div>
            </section>
          )}
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
                            onClick={() => { setReglaSel(r.rule_id); setSlugSel(null); setTab("constructor"); }}>
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
                                      onClick={() => { setReglaSel(c.rule_id); setSlugSel(c.slug ?? null); setTab("constructor"); }}>
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
          {!carrierMode && (cat?.custom ?? []).length > 0 && (
            <section>
              <div className="flex items-center gap-2 pb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Síntomas propios</h2>
                <span className="text-xs text-gray-500">{(cat?.custom ?? []).length} · creados o clonados por la torre</span>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                {(cat?.custom ?? []).map((c) => (
                  <div key={c.rule_id ?? c.slug} className="rounded-lg border border-blue-300 dark:border-blue-800 px-3 py-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</div>
                      <div className="text-[11px] text-gray-500">{c.active ? "encendido" : "apagado"} · {c.fired_24h} disparos 24 h</div>
                    </div>
                    {c.rule_id != null && (
                      <button className="text-xs text-blue-600 hover:underline"
                              onClick={() => { setReglaSel(c.rule_id); setSlugSel(c.slug ?? null); setTab("constructor"); }}>
                        abrir
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
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

      {/* ── Ficha del síntoma (S3 — contrato mockup_ficha_sintoma) ── */}
      {tab === "constructor" && (
        <div className="pb-8">
          {reglaSel == null ? (
            <div className="text-sm text-gray-500">
              Elige un síntoma desde el catálogo («abrir») o clona una caja para crear la tuya.
            </div>
          ) : (
            <FichaSintoma key={reglaSel} ruleId={reglaSel} slug={slugSel} />
          )}
          {msgCons && <div className="text-sm text-gray-700 dark:text-gray-300 pt-2">{msgCons}</div>}
        </div>
      )}

      {/* ── Fuentes de condición (X6a — capa declarativa) ── */}
      {tab === "fuentes" && <FuentesCondicion carrierMode={carrierMode} />}

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

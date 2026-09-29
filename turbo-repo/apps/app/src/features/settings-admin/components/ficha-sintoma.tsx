"use client";

// S3 · Ficha del síntoma (contrato: mockup_ficha_sintoma.html, validado
// 2026-08-08). Reemplaza al constructor plano: cada síntoma es un objeto
// gobernable con 3 planos — (1) IMPACTO real de 30 días (fn_pt4_impacto,
// espejo local), (2) criterios por criticidad EDITABLES respetando los
// pisos del esquema, (3) AUTOMATISMOS 100% parametrizables por nivel
// (acción del catálogo único + conexión del esquema de Integrations del
// Coordinador + params + TTL propio + auto-desactivación). Las
// credenciales nunca llegan aquí: solo la referencia a la conexión.
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Checkbox, Label, TextInput, Select as DsSelect, ToggleSwitch } from "flowbite-react";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";

/** Campo estándar del DS: Label arriba, control, ayuda abajo — nunca
 *  placeholder-como-label (regla de formularios del app). */
export function Campo({ id, label, ayuda, className, children }: {
  id: string; label: string; ayuda?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1 block text-xs">{label}</Label>
      {children}
      {ayuda && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{ayuda}</p>}
    </div>
  );
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});
const post = (fn: string, body: Record<string, unknown>) =>
  fetch(`/app/api/atc/rpc/${fn}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }).then((r) => r.json());

type Criterio = { source?: string; concept?: string; field?: string; op?: string; value?: unknown };
type FuenteCond = {
  source_key: string; nombre: string; activo: boolean; historico: boolean;
  campos: { field_key: string; label: string; unidad: string | null; tipo: string; operadores: string[] }[];
};
type Accion = {
  action_key: string; display_name: string; kind: string; requires_connection: boolean;
  connection_id: string | null; connection_name: string | null;
  params: Record<string, unknown>; ttl_seconds: number;
  auto_desactivar_al_expirar: boolean; enabled: boolean;
};
type Combo = {
  level_key: string; display_name: string; color: string; ord: number;
  icu_code: number | null;
  floor_channels: string[]; operator_required: boolean;
  enabled: boolean; criteria: Criterio[] | null; treatment_type: string | null;
  cuenta_gxc: boolean; gestion_torre: boolean;
  sla_min: number | null; esc_vence: string | null;
  evidencia: string | null; se_ignora: boolean;
  acciones: Accion[];
};

type Recurrencia = { condicion: string; accion: string };
const REC_CONDICIONES = ["2 veces en el mismo viaje", "3 veces en el mismo viaje",
  "2 veces en el mismo turno", "3 veces en 24 horas", "5 veces en 7 días"];
const ESC_ACCIONES = ["Sube un nivel", "Sube a código negro", "Notifica a jefe de transporte",
  "Notifica a canal de operadores", "Notifica a gerencia"];
const EVIDENCIAS = ["No requiere", "Nota obligatoria del operador", "Registro de llamada",
  "Foto/documento adjunto", "Formulario de cierre tipificado"];
const CARGOS = ["Conductor", "Transportista / Jefe de transporte", "Equipo transporte Mintral",
  "Operador torre", "Gerencia"];
type Detalle = {
  rule_id: number; is_active: boolean; display_name: string | null; name: string;
  description: string | null; base_type: string; cloned_from: number | null;
  org_id: string | null; editable: boolean; combinaciones: Combo[];
  recurrencias: Recurrencia[]; esc_no_contesta: string | null;
  alcance?: { modo: "flota" | "segmentos"; items: { kind: string; ref: string; label: string }[] };
  // regla del motor (S3b, migración 070)
  event_pattern: Record<string, unknown> | null;
  trigger_type: string | null;
  deactivate_with_signal: boolean | null;
  auto_deactivate_on_treatment_expire: boolean | null;
  condition_to_deactivate: string | null;
};
type CatalogoAccion = {
  action_key: string; display_name: string; descripcion: string;
  kind: string; requires_connection: boolean; default_params: Record<string, unknown>;
};
type Impacto = {
  ok: boolean; nombre?: string; dias?: number; eventos?: number; viajes?: number;
  viajes_consecuencia?: number; share_eventos_pct?: number;
  costo_mensual_usd?: number | null;
  icu?: { informativo: number; exposicion: number; consecuencia: number; critico: number };
  semanal?: [number, number, number, number][];
};
type Conexion = { id: string; name: string; providerType?: string; status?: string; lastTestResult?: boolean };

const KIND_ICON: Record<string, string> = {
  registro: "📝", contacto: "📞", notificacion: "💬",
  webhook: "🔗", gestion: "🧑‍✈️", derivacion: "🔧",
};
const fmtN = (n: number | undefined | null) => (n ?? 0).toLocaleString("es-CL");

export default function FichaSintoma({ ruleId, slug }: { ruleId: number; slug: string | null }) {
  const { activeOrg } = useOrgScopes();
  const orgSlug = activeOrg?.slug ?? null;
  const [msg, setMsg] = useState<string | null>(null);
  const [fanout, setFanout] = useState<Record<string, unknown> | null>(null);

  const { data: det, mutate: refrescar } = useSWR<Detalle>(
    `/app/api/atc/rpc/fn_pt4_rule_detail?p_rule_id=${ruleId}`, fetcher);
  const { data: imp } = useSWR<Impacto>(
    slug ? `/app/api/atc/rpc/fn_pt4_impacto?p_slug=${encodeURIComponent(slug)}` : null,
    fetcher, { revalidateOnFocus: false });
  const { data: catalogo } = useSWR<CatalogoAccion[]>(
    "/app/api/atc/rpc/fn_pt4_actions_catalog", fetcher, { revalidateOnFocus: false });
  // vocabulario federado de condiciones: señal + fuentes declaradas (X6a)
  const { data: fuentesCond } = useSWR<FuenteCond[]>(
    "/app/api/atc/rpc/fn_pt4_condition_sources", fetcher, { revalidateOnFocus: false });
  // Conexiones del esquema de Integrations del Coordinador — solo referencia.
  // Si el backend no está disponible (lab sin Quarkus integrations), la ficha
  // lo dice y permite ingresar la referencia a mano.
  const { data: conns, error: connsError } = useSWR<Conexion[]>(
    orgSlug ? `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations/connections` : null,
    fetcher, { revalidateOnFocus: false, shouldRetryOnError: false });
  const conexiones = useMemo(
    () => (Array.isArray(conns) ? conns.filter((c) => c.status !== "INACTIVE") : []),
    [conns]);

  const editable = det?.editable ?? false;

  const toggleRegla = async () => {
    if (!det) return;
    const res = await post("fn_pt4_apply_selection", {
      p_changes: [{ rule_id: det.rule_id, active: !det.is_active }], p_actor: "app-ficha" });
    setMsg(res?.ok === false ? `${res?.detalle ?? res?.error}` : null);
    void refrescar();
  };

  const estimar = async () => setFanout(await post("fn_pt4_estimate", { p_rule_id: ruleId }));

  if (!det) return <div className="text-sm text-gray-500">Cargando ficha…</div>;

  return (
    <div className="space-y-5 pb-16">
      {/* Cabecera */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className={`relative inline-flex items-center ${editable ? "cursor-pointer" : "opacity-50"}`}>
          <input type="checkbox" className="sr-only peer" checked={det.is_active}
                 disabled={!editable} onChange={() => void toggleRegla()} />
          <span className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
        </label>
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {det.display_name ?? det.name}
          </div>
          <div className="text-xs text-gray-500">
            regla #{det.rule_id} · {det.base_type}
            {det.cloned_from != null && <> · clon de #{det.cloned_from}</>}
            {det.org_id && <> · org {det.org_id}</>}
            {imp?.costo_mensual_usd != null && <> · US$ {imp.costo_mensual_usd}/mes</>}
            {!editable && " · solo lectura para tu organización"}
          </div>
        </div>
        <span className="flex-1" />
        <button onClick={() => void estimar()}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
          Estimar fanout
        </button>
      </div>

      {fanout && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm flex items-center gap-4 flex-wrap">
          <span className="font-medium text-gray-900 dark:text-white">Fanout (dry-run)</span>
          <span>riesgo <b>{String(fanout.risk_level)}</b></span>
          <span>{Number(fanout.matches_per_hour ?? 0)} coincidencias/h</span>
          <span>US$ {Number(fanout.cost_monthly_usd_estimate ?? 0)}/mes estimado</span>
        </div>
      )}

      {/* 1 · IMPACTO — últimos 30 días */}
      <section>
        <h2 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 mb-2">
          1 · IMPACTO — ÚLTIMOS {imp?.dias ?? 30} DÍAS (datos reales)
        </h2>
        {!slug && (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-gray-500">
            Sin medidor para esta regla (clon sin síntoma del catálogo asociado).
          </div>
        )}
        {slug && !imp && <div className="text-sm text-gray-500">Midiendo…</div>}
        {imp?.ok === false && (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-gray-500">
            El espejo local no tiene datos para este síntoma.
          </div>
        )}
        {imp?.ok && <PanelImpacto imp={imp} />}
      </section>

      {/* 2 · ALCANCE (X1) */}
      <section>
        <h2 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 mb-2">
          2 · ALCANCE — ¿a quiénes les rige esta regla?
        </h2>
        <SeccionAlcance det={det} editable={editable}
                        onMsg={setMsg} onCambio={() => { void refrescar(); }} />
      </section>

      {/* 3 · REGLA DEL MOTOR */}
      <section>
        <h2 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 mb-2">
          3 · REGLA DEL MOTOR — cuándo empieza a acumular y cómo se apaga
        </h2>
        <SeccionMotor det={det} editable={editable}
                      onMsg={setMsg} onCambio={() => { void refrescar(); }} />
      </section>

      {/* 3 · QUÉ HACER EN CADA CRITICIDAD */}
      <section>
        <h2 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 mb-2">
          4 · QUÉ HACER EN CADA CRITICIDAD — criterios y automatismos
        </h2>
        <div className="space-y-2.5">
          {det.combinaciones.map((cb) => (
            <NivelCard key={cb.level_key} cb={cb} ruleId={ruleId} editable={editable}
                       catalogo={catalogo ?? []} fuentesCond={fuentesCond ?? []} conexiones={conexiones}
                       connsDisponibles={!connsError && Array.isArray(conns)}
                       onCambio={() => { void refrescar(); }} onMsg={setMsg} />
          ))}
        </div>
      </section>

      {/* 5 · RECURRENCIA Y ESCALAMIENTO (instrumento de parametrización) */}
      <section>
        <h2 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 mb-2">
          5 · RECURRENCIA Y ESCALAMIENTO
        </h2>
        <SeccionRecurrencias det={det} ruleId={ruleId} editable={editable}
                             onMsg={setMsg} onCambio={() => { void refrescar(); }} />
      </section>

      {/* 4 · Expiración */}
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-[13px] text-gray-600 dark:text-gray-300">
        Cada automatismo tiene su <b>TTL propio</b>: si el síntoma vuelve a normal antes, el
        tratamiento expira y queda como <b>medición</b> (autorregulación — no es deuda de gestión).
        Con <b>auto-desactivar</b>, la expiración además resetea el acumulador del síntoma.
        Las acciones con conexión se ejecutan por el esquema de conexiones del Coordinador — aquí
        solo se guarda la referencia, nunca credenciales.
      </section>

      {msg && <div className="text-sm text-gray-700 dark:text-gray-300">{msg}</div>}
    </div>
  );
}

type ScopeItem = { kind: string; ref: string; label: string };

function SeccionAlcance({ det, editable, onMsg, onCambio }: {
  det: Detalle; editable: boolean;
  onMsg: (m: string) => void; onCambio: () => void;
}) {
  const alcance = det.alcance ?? { modo: "flota" as const, items: [] };
  const [modo, setModo] = useState<"flota" | "segmentos">(alcance.modo);
  const [items, setItems] = useState<ScopeItem[]>(alcance.items);
  const [guardando, setGuardando] = useState(false);
  const [cobertura, setCobertura] = useState<Record<string, unknown> | null>(null);
  const [patente, setPatente] = useState("");

  const { data: carriers } = useSWR<{ nombre: string; camiones: number }[]>(
    "/app/api/atc/rpc/fn_pt4_scope_carriers", fetcher, { revalidateOnFocus: false });
  const { data: lugares } = useSWR<{ place_id: string; name: string }[]>(
    "/app/api/atc/rpc/fn_pt4_places_global", fetcher, { revalidateOnFocus: false });
  const { data: trayectos } = useSWR<{ trayecto_id?: string; id?: string; name: string }[]>(
    "/app/api/atc/rpc/fn_pt4_trayectos_global", fetcher, { revalidateOnFocus: false });
  useSWR(`cov-${det.rule_id}`, () =>
    fetcher(`/app/api/atc/rpc/fn_pt4_scope_coverage?p_rule_id=${det.rule_id}`)
      .then((c) => { setCobertura(c); return c; }).catch(() => null),
    { revalidateOnFocus: false });

  // la cobertura solo se muestra cuando refleja lo GUARDADO — con cambios
  // pendientes o segmentos vacíos sería la foto anterior (engañosa)
  const sucio = modo !== alcance.modo ||
    JSON.stringify(items) !== JSON.stringify(alcance.items);
  const coberturaVisible = cobertura != null && !sucio &&
    !(modo === "segmentos" && items.length === 0);

  const agregar = (kind: string, ref: string, label: string) => {
    if (!ref) return;
    setItems((xs) => xs.some((x) => x.kind === kind && x.ref === ref)
      ? xs : [...xs, { kind, ref, label }]);
  };

  const guardar = async () => {
    setGuardando(true);
    const res = await post("fn_pt4_save_scope", {
      p_rule_id: det.rule_id, p_modo: modo,
      p_items: modo === "segmentos" ? items : [], p_actor: "app-ficha" });
    setGuardando(false);
    if (res?.ok === false) { onMsg(`No guardado — ${res?.detalle ?? res?.error}`); return; }
    setCobertura(res?.cobertura ?? null);
    onMsg("Alcance guardado (auditado).");
    onCambio();
  };

  const KIND_TAG: Record<string, string> = { carrier: "🏢", trayecto: "🛣", lugar: "📍", patente: "🚚" };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3.5 space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
          <input type="radio" name={`alc-${det.rule_id}`} checked={modo === "flota"}
                 disabled={!editable} onChange={() => setModo("flota")} />
          Toda la flota
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
          <input type="radio" name={`alc-${det.rule_id}`} checked={modo === "segmentos"}
                 disabled={!editable} onChange={() => setModo("segmentos")} />
          Solo estos segmentos
        </label>
        <span className="flex-1" />
        {coberturaVisible && (
          <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
            Cobertura: {fmtN(Number(cobertura!.camiones ?? 0))} camiones
            {Number(cobertura!.carriers ?? 0) > 0 && <> · {String(cobertura!.carriers)} transportistas</>}
            <span className="font-normal text-gray-500"> (30 días reales)</span>
          </span>
        )}
        {!coberturaVisible && sucio && (
          <span className="text-[12px] text-gray-500 dark:text-gray-400">
            guarda para recalcular la cobertura
          </span>
        )}
      </div>

      {modo === "segmentos" && (
        <>
          <div className="flex gap-1.5 flex-wrap">
            {items.map((it) => (
              <span key={it.kind + it.ref}
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-400 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 text-xs font-medium">
                {KIND_TAG[it.kind]} {it.label}
                {editable && (
                  <button className="opacity-60 hover:opacity-100"
                          onClick={() => setItems((xs) => xs.filter((x) => !(x.kind === it.kind && x.ref === it.ref)))}>×</button>
                )}
              </span>
            ))}
            {items.length === 0 && (
              <span className="text-xs text-gray-400">Sin segmentos — agrega al menos uno</span>
            )}
          </div>
          {editable && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
              <Campo id="alc-carrier" label="Transportista">
                <DsSelect id="alc-carrier" sizing="sm" value=""
                        onChange={(e) => { const c = (carriers ?? []).find((x) => x.nombre === e.target.value);
                          if (c) agregar("carrier", c.nombre, c.nombre.trim()); }}>
                  <option value="">— agregar transportista —</option>
                  {(carriers ?? []).map((c) => (
                    <option key={c.nombre} value={c.nombre}>{c.nombre.trim()} · {c.camiones} camiones</option>
                  ))}
                </DsSelect>
              </Campo>
              <Campo id="alc-tray" label="Ruta / trayecto (PT4)">
                <DsSelect id="alc-tray" sizing="sm" value=""
                        onChange={(e) => { const t = (trayectos ?? []).find((x) => (x.trayecto_id ?? x.id) === e.target.value);
                          if (t) agregar("trayecto", t.trayecto_id ?? t.id ?? "", t.name); }}>
                  <option value="">{(trayectos ?? []).length ? "— agregar trayecto —" : "sin trayectos publicados"}</option>
                  {(trayectos ?? []).map((t) => (
                    <option key={t.trayecto_id ?? t.id} value={t.trayecto_id ?? t.id}>{t.name}</option>
                  ))}
                </DsSelect>
              </Campo>
              <Campo id="alc-lugar" label="Lugar (PT4)">
                <DsSelect id="alc-lugar" sizing="sm" value=""
                        onChange={(e) => { const l = (lugares ?? []).find((x) => x.place_id === e.target.value);
                          if (l) agregar("lugar", l.place_id, l.name); }}>
                  <option value="">— agregar lugar —</option>
                  {(lugares ?? []).map((l) => (
                    <option key={l.place_id} value={l.place_id}>{l.name}</option>
                  ))}
                </DsSelect>
              </Campo>
              <Campo id="alc-patente" label="Patente" ayuda="Enter para agregar">
                <TextInput id="alc-patente" sizing="sm" value={patente}
                           onChange={(e) => setPatente(e.target.value.toUpperCase())}
                           onKeyDown={(e) => { if (e.key === "Enter" && patente.trim()) {
                             agregar("patente", patente.trim(), patente.trim()); setPatente(""); } }} />
              </Campo>
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-3">
        {editable && (
          <button onClick={() => void guardar()} disabled={guardando}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar alcance"}
          </button>
        )}
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          Fuera del alcance la señal ni siquiera acumula. Trayectos y lugares aplican por geografía.
        </span>
      </div>
    </div>
  );
}

function SeccionMotor({ det, editable, onMsg, onCambio }: {
  det: Detalle; editable: boolean;
  onMsg: (m: string) => void; onCambio: () => void;
}) {
  const [nombre, setNombre] = useState(det.display_name ?? det.name);
  const [descr, setDescr] = useState(det.description ?? "");
  const [pares, setPares] = useState<[string, string][]>(
    Object.entries(det.event_pattern ?? {}).map(([k, v]) => [k, String(v)]));
  const [trigger, setTrigger] = useState(det.trigger_type ?? "signal");
  const [conSenal, setConSenal] = useState(det.deactivate_with_signal ?? true);
  const [autoDes, setAutoDes] = useState(det.auto_deactivate_on_treatment_expire ?? false);
  const [condicion, setCondicion] = useState(det.condition_to_deactivate ?? "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const pattern: Record<string, unknown> = {};
    for (const [k, v] of pares) {
      if (!k.trim()) continue;
      const n = Number(v);
      pattern[k.trim()] = v !== "" && !isNaN(n) ? n : v;
    }
    if (Object.keys(pattern).length === 0) {
      onMsg("El event_pattern necesita al menos una condición."); return;
    }
    setGuardando(true);
    const res = await post("fn_pt4_save_engine_rule", {
      p_rule_id: det.rule_id, p_display_name: nombre, p_description: descr,
      p_event_pattern: pattern, p_trigger_type: trigger,
      p_deactivate_with_signal: conSenal, p_auto_deactivate: autoDes,
      p_condition_to_deactivate: condicion, p_actor: "app-ficha" });
    setGuardando(false);
    onMsg(res?.ok === false
      ? `No guardado — ${res?.detalle ?? res?.error}`
      : "Regla del motor guardada (auditada). Corre «Estimar fanout» para validar el alcance del nuevo pattern.");
    onCambio();
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3.5 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <Campo id="motor-nombre" label="Nombre visible">
          <TextInput id="motor-nombre" sizing="sm" value={nombre} disabled={!editable}
                     onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo id="motor-descr" label="Descripción">
          <TextInput id="motor-descr" sizing="sm" value={descr} disabled={!editable}
                     onChange={(e) => setDescr(e.target.value)} />
        </Campo>
      </div>

      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          <b className="text-gray-700 dark:text-gray-200">Cuándo EMPIEZA a acumular</b> — el matcher que
          la señal debe contener. Los criterios de la sección 3 deciden cuándo ESCALA de criticidad.
        </div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[240px_110px_1fr] gap-2">
            <Label className="text-[11px] text-gray-500">Condición de la señal</Label>
            <Label className="text-[11px] text-gray-500">Valor</Label>
            <span />
          </div>
          {pares.map(([k, v], i) => (
            <div key={i} className="grid grid-cols-[240px_110px_1fr] gap-2 items-center">
              <TextInput sizing="sm" className="font-mono" value={k} disabled={!editable}
                     aria-label="Condición de la señal"
                     onChange={(e) => setPares((ps) => ps.map((x, j) => j === i ? [e.target.value, x[1]] : x))} />
              <TextInput sizing="sm" className="font-mono" value={v} disabled={!editable}
                     aria-label="Valor"
                     onChange={(e) => setPares((ps) => ps.map((x, j) => j === i ? [x[0], e.target.value] : x))} />
              {editable && (
                <button className="text-xs text-red-600 justify-self-start"
                        onClick={() => setPares((ps) => ps.filter((_, j) => j !== i))}>quitar</button>
              )}
            </div>
          ))}
          {editable && (
            <button className="text-xs text-blue-600 hover:underline"
                    onClick={() => setPares((ps) => [...ps, ["", "1"]])}>+ condición</button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Cómo se APAGA</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          <Campo id="motor-trigger" label="Disparo">
            <DsSelect id="motor-trigger" sizing="sm" value={trigger} disabled={!editable}
                      onChange={(e) => setTrigger(e.target.value)}>
              <option value="signal">Por señal</option>
              <option value="interval">Por intervalo</option>
            </DsSelect>
          </Campo>
          <Campo id="motor-cond" label="Condición especial de apagado"
                 ayuda="Vacío = ninguna. Ej: Detention">
            <TextInput id="motor-cond" sizing="sm" value={condicion} disabled={!editable}
                       onChange={(e) => setCondicion(e.target.value)} />
          </Campo>
          <div className="pt-5">
            <ToggleSwitch checked={conSenal} disabled={!editable}
                          label="Se apaga al normalizarse la señal"
                          onChange={() => setConSenal(!conSenal)} />
          </div>
          <div className="pt-5">
            <ToggleSwitch checked={autoDes} disabled={!editable}
                          label="Auto-desactivar al expirar"
                          onChange={() => setAutoDes(!autoDes)} />
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Fallback de la regla — si un automatismo define el suyo, manda el del automatismo
            </p>
          </div>
        </div>
        {editable && (
          <button onClick={() => void guardar()} disabled={guardando}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar regla del motor"}
          </button>
        )}
      </div>
    </div>
  );
}

function PanelImpacto({ imp }: { imp: Impacto }) {
  const icu = imp.icu ?? { informativo: 0, exposicion: 0, consecuencia: 0, critico: 0 };
  const tot = Math.max(1, icu.informativo + icu.exposicion + icu.consecuencia + icu.critico);
  const ruidoPct = Math.round((icu.informativo / tot) * 1000) / 10;
  const sem = imp.semanal ?? [];
  const maxEv = Math.max(1, ...sem.map((s) => s[1]));
  const filas: [string, number, string, string][] = [
    ["Informativo (ICU 0-1)", icu.informativo, "#9CA3AF", "solo medición — no genera gestión"],
    ["Exposición (ICU 2)", icu.exposicion, "#D97706", "señal que suma al perfil GxC"],
    ["Consecuencia (ICU 3)", icu.consecuencia, "#E11D48", "exigible — cuenta contra el responsable"],
    ["Crítico (ICU 4+)", icu.critico, "#111928", "protocolo de torre"],
  ];
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3.5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Eventos</div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">{fmtN(imp.eventos)}</div>
          {imp.share_eventos_pct != null && (
            <div className="text-xs text-gray-500">el {imp.share_eventos_pct}% de todo lo que suena</div>)}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Viajes tocados</div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">{fmtN(imp.viajes)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Viajes con consecuencia</div>
          <div className="text-2xl font-extrabold tabular-nums" style={{ color: "#E11D48" }}>
            {fmtN(imp.viajes_consecuencia)}</div>
          <div className="text-xs text-gray-500">terminaron en ICU≥3 por este síntoma</div>
        </div>
      </div>
      <div className="grid md:grid-cols-[1.3fr_1fr] gap-4">
        <div>
          <div className="text-[11px] text-gray-500 mb-1">DISTRIBUCIÓN POR CRITICIDAD</div>
          {filas.map(([l, n, c, nota]) => (
            <div key={l} className="grid grid-cols-[150px_1fr_80px] md:grid-cols-[170px_1fr_90px_1fr] gap-2.5 items-center my-1.5 text-[12.5px]">
              <span className="font-semibold text-gray-900 dark:text-white">{l}</span>
              <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0.5, (n / tot) * 100)}%`, background: c }} />
              </div>
              <b className="text-right tabular-nums text-gray-900 dark:text-white">{fmtN(n)}</b>
              <span className="hidden md:block text-[11.5px] text-gray-500">{nota}</span>
            </div>
          ))}
          {ruidoPct >= 90 && (
            <div className="text-xs text-gray-500 pt-1">
              ⚠ El {ruidoPct}% de este síntoma es informativo: mide, no gestiona. Si el objetivo es
              reducir ruido, el criterio de ICU 0-1 es lo primero que hay que mirar.
            </div>
          )}
        </div>
        <div>
          <div className="text-[11px] text-gray-500 mb-1">EVENTOS POR SEMANA</div>
          <div className="flex items-end gap-3 pt-1">
            {sem.map((s, i) => (
              <div key={s[0]} className="text-center text-[10.5px] text-gray-500">
                <div className="h-[56px] flex items-end justify-center">
                  <div className="w-6 rounded-t" style={{ height: `${Math.max(6, (s[1] / maxEv) * 54)}px`,
                    background: "rgba(28,100,242,0.35)" }} />
                </div>
                <span>S{i + 1}</span>
                <em className="block not-italic font-bold text-[10px] text-gray-900 dark:text-white">{fmtN(s[1])}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NivelCard({ cb, ruleId, editable, catalogo, fuentesCond, conexiones, connsDisponibles, onCambio, onMsg }: {
  cb: Combo; ruleId: number; editable: boolean;
  catalogo: CatalogoAccion[]; fuentesCond: FuenteCond[]; conexiones: Conexion[]; connsDisponibles: boolean;
  onCambio: () => void; onMsg: (m: string) => void;
}) {
  const [editandoCrit, setEditandoCrit] = useState(false);
  const [criterios, setCriterios] = useState<Criterio[]>(cb.criteria ?? []);
  const [agregando, setAgregando] = useState(false);
  const [editandoAccion, setEditandoAccion] = useState<Accion | null>(null);
  const [avisoNivel, setAvisoNivel] = useState<string | null>(null);

  const guardarCombo = async (enabled: boolean, crit: Criterio[]) => {
    setAvisoNivel(null);
    // habilitar sin criterios: en vez de fallar mudo, abrir el editor y explicar
    if (enabled && crit.length === 0) {
      setCriterios([{ source: "senal", concept: "", op: ">=", value: 0 }]);
      setEditandoCrit(true);
      setAvisoNivel("Para habilitar este nivel primero define su criterio y guarda.");
      return;
    }
    const res = await post("fn_pt4_save_combination", {
      p_rule_id: ruleId, p_level_key: cb.level_key, p_enabled: enabled,
      p_criteria: crit, p_treatment: cb.treatment_type ?? "registro", p_actor: "app-ficha" });
    if (res?.ok === false) {
      setAvisoNivel(`No guardado — ${res?.detalle ?? res?.error}`);
      if (res?.error === "criterios_requeridos") setEditandoCrit(true);
      return;
    }
    onMsg("Guardado (auditado).");
    setEditandoCrit(false); onCambio();
  };

  // Destinos del nivel: «cuenta para GxC» (medición) y «gestión de torre»
  // (exige operador — la acción gestion_operador se agrega sola en el back)
  const guardarDestinos = async (cuentaGxc: boolean, gestionTorre: boolean) => {
    setAvisoNivel(null);
    const res = await post("fn_pt4_save_combination", {
      p_rule_id: ruleId, p_level_key: cb.level_key, p_enabled: cb.enabled,
      p_criteria: cb.criteria ?? [], p_treatment: cb.treatment_type ?? "registro",
      p_cuenta_gxc: cuentaGxc, p_gestion_torre: gestionTorre, p_actor: "app-ficha" });
    if (res?.ok === false) { setAvisoNivel(`${res?.detalle ?? res?.error}`); return; }
    onMsg("Destino del nivel guardado (auditado) — el visor GxC mide con esta configuración.");
    onCambio();
  };

  // Gobierno del instrumento por nivel: SLA, escalamiento, evidencia, se ignora
  const guardarInstrumento = async (campos: {
    sla_min?: number | null; esc_vence?: string | null;
    evidencia?: string | null; se_ignora?: boolean;
  }) => {
    setAvisoNivel(null);
    const res = await post("fn_pt4_save_combination", {
      p_rule_id: ruleId, p_level_key: cb.level_key, p_enabled: cb.enabled,
      p_criteria: cb.criteria ?? [], p_treatment: cb.treatment_type ?? "registro",
      p_sla_min: campos.sla_min, p_esc_vence: campos.esc_vence,
      p_evidencia: campos.evidencia, p_se_ignora: campos.se_ignora,
      p_actor: "app-ficha" });
    if (res?.ok === false) { setAvisoNivel(`${res?.detalle ?? res?.error}`); return; }
    onMsg("Parametrización del nivel guardada (auditada).");
    onCambio();
  };

  const eliminarAccion = async (a: Accion) => {
    const res = await post("fn_pt4_delete_action", {
      p_rule_id: ruleId, p_level_key: cb.level_key, p_action_key: a.action_key, p_actor: "app-ficha" });
    onMsg(res?.ok === false ? `${res?.detalle ?? res?.error}` : "Automatismo eliminado (auditado).");
    onCambio();
  };

  const etiquetaCampo = (c: Criterio) => {
    for (const f of fuentesCond)
      for (const cf of f.campos)
        if (cf.field_key === (c.concept ?? c.field)) return cf.label;
    return c.concept ?? c.field ?? "?";
  };
  const critTxt = (cb.criteria ?? []).map((c) =>
    `${etiquetaCampo(c)} ${c.op ?? ""} ${String(c.value ?? "")}`).join(" · ");

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
         style={{ borderLeft: `4px solid ${cb.color}` }}>
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <label className={`relative inline-flex items-center ${editable ? "cursor-pointer" : "opacity-50"}`}>
          <input type="checkbox" className="sr-only peer" checked={cb.enabled} disabled={!editable}
                 onChange={() => void guardarCombo(!cb.enabled, cb.criteria ?? [])} />
          <span className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
        </label>
        <b className="text-sm" style={{ color: cb.color }}>{cb.display_name}</b>
        <span className="text-[12.5px] text-gray-600 dark:text-gray-300">
          criterio: <b>{critTxt || "sin criterios"}</b>
        </span>
        {editable && (
          <button className="text-[11px] border border-gray-300 dark:border-gray-600 rounded-md px-2 py-0.5 text-gray-600 dark:text-gray-300"
                  onClick={() => { setCriterios(cb.criteria ?? []); setEditandoCrit((v) => !v); }}>
            {editandoCrit ? "cerrar" : "editar criterio"}
          </button>
        )}
        <span className="ml-auto flex items-center gap-4">
          <label className={`flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300 ${editable ? "cursor-pointer" : "opacity-50"}`}
                 title="Este nivel cuenta para los perfiles GxC (medición)">
            <input type="checkbox" checked={cb.cuenta_gxc} disabled={!editable}
                   onChange={() => void guardarDestinos(!cb.cuenta_gxc, cb.gestion_torre)} />
            Cuenta GxC
          </label>
          <label className={`flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300 ${editable ? "cursor-pointer" : "opacity-50"}`}
                 title="Este nivel exige gestión de operador en la torre (crea el caso)">
            <input type="checkbox" checked={cb.gestion_torre} disabled={!editable}
                   onChange={() => void guardarDestinos(cb.cuenta_gxc, !cb.gestion_torre)} />
            Gestión torre
          </label>
          <span className="text-[11px] text-gray-500">
            piso: {cb.floor_channels.join(" · ") || "sin piso"}
            {cb.operator_required && " · exige operador"}
          </span>
        </span>
      </div>
      <div className="flex items-end gap-3 flex-wrap mb-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2.5">
        <Campo id={`niv-sla-${cb.level_key}`} label="SLA atención (min)">
          <TextInput id={`niv-sla-${cb.level_key}`} sizing="sm" type="number" min={0} className="w-24"
                     defaultValue={cb.sla_min ?? ""} disabled={!editable}
                     onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value);
                       if (v !== cb.sla_min) void guardarInstrumento({ sla_min: v }); }} />
        </Campo>
        <Campo id={`niv-esc-${cb.level_key}`} label="Si vence el SLA">
          <DsSelect id={`niv-esc-${cb.level_key}`} sizing="sm" value={cb.esc_vence ?? ""} disabled={!editable}
                  onChange={(e) => void guardarInstrumento({ esc_vence: e.target.value || null })}>
            <option value="">—</option>
            {ESC_ACCIONES.map((x) => <option key={x} value={x}>{x}</option>)}
          </DsSelect>
        </Campo>
        <Campo id={`niv-evid-${cb.level_key}`} label="Evidencia al gestionar">
          <DsSelect id={`niv-evid-${cb.level_key}`} sizing="sm" value={cb.evidencia ?? ""} disabled={!editable}
                  onChange={(e) => void guardarInstrumento({ evidencia: e.target.value || null })}>
            <option value="">—</option>
            {EVIDENCIAS.map((x) => <option key={x} value={x}>{x}</option>)}
          </DsSelect>
        </Campo>
        <label htmlFor={`niv-ign-${cb.level_key}`}
               className={`flex items-center gap-2 pb-1 text-[12px] text-gray-600 dark:text-gray-300 ${editable ? "cursor-pointer" : "opacity-50"}`}
               title="El nivel se registra y alimenta el análisis, pero no genera reacción en tiempo real">
          <Checkbox id={`niv-ign-${cb.level_key}`} checked={cb.se_ignora} disabled={!editable}
                    onChange={() => void guardarInstrumento({ se_ignora: !cb.se_ignora })} />
          Se ignora en tiempo real
        </label>
      </div>
      {avisoNivel && (
        <div className="text-[12px] rounded-lg px-3 py-1.5 mb-2"
             style={{ background: "rgba(217,119,6,.12)", color: "#B45309" }}>
          {avisoNivel}
        </div>
      )}

      {editandoCrit && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2.5 mb-2 space-y-2">
          <div className="grid grid-cols-[260px_80px_100px_1fr] gap-2">
            <Label className="text-[11px] text-gray-500">Campo (por fuente)</Label>
            <Label className="text-[11px] text-gray-500">Operador</Label>
            <Label className="text-[11px] text-gray-500">Valor</Label>
            <span />
          </div>
          {criterios.map((c, i) => {
            const clave = String(c.concept ?? c.field ?? "");
            const conocido = fuentesCond.some((f) => f.campos.some((cf) => cf.field_key === clave));
            const campoSel = fuentesCond.flatMap((f) => f.campos).find((cf) => cf.field_key === clave);
            const ops = campoSel?.operadores?.length ? campoSel.operadores : [">=", ">", "=", "<", "<="];
            return (
              <div key={i} className="grid grid-cols-[260px_80px_100px_1fr] gap-2 items-center">
                <DsSelect sizing="sm" value={clave} aria-label="Campo"
                        onChange={(e) => {
                          const nueva = e.target.value;
                          const fuente = fuentesCond.find((f) => f.campos.some((cf) => cf.field_key === nueva));
                          setCriterios((cs) => cs.map((x, j) => j === i
                            ? { ...x, concept: nueva, field: undefined, source: fuente?.source_key ?? "senal" } : x));
                        }}>
                  {!conocido && clave !== "" && <option value={clave}>(actual) {clave}</option>}
                  {clave === "" && <option value="">— elegir campo —</option>}
                  {fuentesCond.filter((f) => f.activo).map((f) => (
                    <optgroup key={f.source_key}
                              label={f.nombre + (f.source_key !== "senal" ? " (fuente declarada)" : "")}>
                      {f.campos.map((cf) => (
                        <option key={cf.field_key} value={cf.field_key}>
                          {cf.label}{cf.unidad ? ` (${cf.unidad})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </DsSelect>
                <DsSelect sizing="sm" value={String(c.op ?? ops[0])} aria-label="Operador"
                        onChange={(e) => setCriterios((cs) => cs.map((x, j) => j === i ? { ...x, op: e.target.value } : x))}>
                  {ops.map((o) => <option key={o} value={o}>{o}</option>)}
                </DsSelect>
                <TextInput sizing="sm" value={String(c.value ?? "")} aria-label="Valor"
                       onChange={(e) => setCriterios((cs) => cs.map((x, j) => j === i ? { ...x, value: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) } : x))} />
                <button className="text-xs text-red-600 justify-self-start" onClick={() => setCriterios((cs) => cs.filter((_, j) => j !== i))}>
                  quitar
                </button>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <button className="text-xs text-blue-600 hover:underline"
                    onClick={() => setCriterios((cs) => [...cs, { source: "senal", concept: "", op: ">=", value: 0 }])}>
              + criterio
            </button>
            <span className="flex-1" />
            <button className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5"
                    onClick={() => void guardarCombo(
                      cb.enabled || avisoNivel != null, criterios.filter((c) => (c.concept ?? "").toString().trim() !== ""))}>
              {avisoNivel != null && !cb.enabled ? "Guardar y habilitar" : "Guardar criterios"}
            </button>
          </div>
        </div>
      )}

      {/* Automatismos del nivel */}
      <div className="space-y-1.5">
        {cb.acciones.map((a) => (
          <div key={a.action_key} className="flex items-center gap-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
            <span>{KIND_ICON[a.kind] ?? "⚙️"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-gray-900 dark:text-white">
                {a.display_name}{!a.enabled && <span className="text-gray-400 font-normal"> · apagado</span>}
              </div>
              <div className="text-[11.5px] text-gray-500 truncate">
                expira a los {a.ttl_seconds} s (= se normalizó)
                {a.auto_desactivar_al_expirar && " · resetea el acumulador"}
                {Object.keys(a.params ?? {}).length > 0 && <> · {JSON.stringify(a.params)}</>}
              </div>
            </div>
            {a.requires_connection ? (
              <span className="text-[11px] font-bold rounded-full px-2 py-0.5"
                    style={{ color: "#0E9F6E", background: "rgba(14,159,110,.1)" }}>
                🔌 {a.connection_name ?? a.connection_id}
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">acción interna</span>
            )}
            {editable && (
              <>
                <button className="text-[11px] border border-gray-300 dark:border-gray-600 rounded-md px-2 py-0.5 text-gray-600 dark:text-gray-300"
                        onClick={() => { setEditandoAccion(a); setAgregando(false); }}>editar</button>
                <button className="text-[11px] text-red-600" onClick={() => void eliminarAccion(a)}>eliminar</button>
              </>
            )}
          </div>
        ))}
        {cb.acciones.length === 0 && !agregando && !editandoAccion && (
          <div className="text-[12px] text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
            Sin automatismos configurados para este nivel.
          </div>
        )}
        {(agregando || editandoAccion) && (
          <AccionForm ruleId={ruleId} levelKey={cb.level_key} catalogo={catalogo}
                      conexiones={conexiones} connsDisponibles={connsDisponibles}
                      inicial={editandoAccion}
                      onCerrar={() => { setAgregando(false); setEditandoAccion(null); }}
                      onGuardado={(m) => { onMsg(m); setAgregando(false); setEditandoAccion(null); onCambio(); }} />
        )}
        {editable && !agregando && !editandoAccion && (
          <button className="w-full text-[12px] font-semibold text-blue-600 border border-dashed border-blue-400 rounded-lg py-1.5 opacity-80 hover:opacity-100"
                  onClick={() => setAgregando(true)}>
            + Agregar automatismo
          </button>
        )}
      </div>
    </div>
  );
}

function AccionForm({ ruleId, levelKey, catalogo, conexiones, connsDisponibles, inicial, onCerrar, onGuardado }: {
  ruleId: number; levelKey: string; catalogo: CatalogoAccion[];
  conexiones: Conexion[]; connsDisponibles: boolean; inicial: Accion | null;
  onCerrar: () => void; onGuardado: (msg: string) => void;
}) {
  const [key, setKey] = useState(inicial?.action_key ?? catalogo[0]?.action_key ?? "registro");
  const [connId, setConnId] = useState(inicial?.connection_id ?? "");
  const [connName, setConnName] = useState(inicial?.connection_name ?? "");
  const [params, setParams] = useState(JSON.stringify(inicial?.params ?? {}, null, 0));
  const [dests, setDests] = useState<string[]>(
    Array.isArray((inicial?.params as Record<string, unknown>)?.destinatarios)
      ? ((inicial?.params as Record<string, unknown>).destinatarios as string[])
      : []);
  const [ttl, setTtl] = useState(inicial?.ttl_seconds ?? 300);
  const [autoDes, setAutoDes] = useState(inicial?.auto_desactivar_al_expirar ?? false);
  const [guardando, setGuardando] = useState(false);
  const accion = catalogo.find((a) => a.action_key === key);

  const guardar = async () => {
    let parsedParams: Record<string, unknown>;
    try { parsedParams = JSON.parse(params || "{}"); }
    catch { onGuardado("Params no es JSON válido."); return; }
    if (dests.length > 0) parsedParams.destinatarios = dests;
    else delete parsedParams.destinatarios;
    setGuardando(true);
    const res = await post("fn_pt4_save_action", {
      p_rule_id: ruleId, p_level_key: levelKey, p_action_key: key,
      p_connection_id: connId || null, p_connection_name: connName || null,
      p_params: parsedParams, p_ttl_seconds: ttl,
      p_auto_desactivar: autoDes, p_enabled: true, p_actor: "app-ficha" });
    setGuardando(false);
    onGuardado(res?.ok === false
      ? `No guardado — ${res?.detalle ?? res?.error}` : "Automatismo guardado (auditado).");
  };

  return (
    <div className="rounded-lg border border-blue-300 dark:border-blue-800 px-3 py-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
        <Campo id="af-accion" label="Acción *">
          <DsSelect id="af-accion" sizing="sm" value={key} disabled={!!inicial}
                  onChange={(e) => { setKey(e.target.value);
                    const a = catalogo.find((x) => x.action_key === e.target.value);
                    if (a && !inicial) setParams(JSON.stringify(a.default_params ?? {})); }}>
            {catalogo.map((a) => (
              <option key={a.action_key} value={a.action_key}>
                {KIND_ICON[a.kind] ?? ""} {a.display_name}
              </option>
            ))}
          </DsSelect>
        </Campo>
        {accion?.requires_connection && (conexiones.length > 0 ? (
          <Campo id="af-conn" label="Conexión *"
                 ayuda="Solo conexiones activas del Coordinador">
            <DsSelect id="af-conn" sizing="sm" value={connId}
                    onChange={(e) => { setConnId(e.target.value);
                      setConnName(conexiones.find((c) => c.id === e.target.value)?.name ?? ""); }}>
              <option value="">— elegir conexión —</option>
              {conexiones.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.lastTestResult === false ? " (test fallido)" : ""}</option>
              ))}
            </DsSelect>
          </Campo>
        ) : (
          <>
            <Campo id="af-connid" label="Id de conexión *"
                   ayuda={connsDisponibles ? undefined : "Integrations no disponible — referencia manual (lab)"}>
              <TextInput id="af-connid" sizing="sm" value={connId}
                         onChange={(e) => setConnId(e.target.value)} />
            </Campo>
            <Campo id="af-connname" label="Nombre de conexión">
              <TextInput id="af-connname" sizing="sm" value={connName}
                         onChange={(e) => setConnName(e.target.value)} />
            </Campo>
          </>
        ))}
        <Campo id="af-ttl" label="TTL (segundos)"
               ayuda="Al expirar = el síntoma volvió a normal">
          <TextInput id="af-ttl" sizing="sm" type="number" min={60} max={86400} value={ttl}
                     onChange={(e) => setTtl(Number(e.target.value))} />
        </Campo>
        <div className="pt-5">
          <ToggleSwitch checked={autoDes} label="Auto-desactivar al expirar"
                        onChange={() => setAutoDes(!autoDes)} />
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Resetea el acumulador del síntoma
          </p>
        </div>
      </div>
      <Campo id="af-dests" label="Destinatarios"
             ayuda="A quién llega esta acción — queda en params.destinatarios">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
          {CARGOS.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-[12px] text-gray-600 dark:text-gray-300 cursor-pointer">
              <Checkbox checked={dests.includes(c)}
                        onChange={() => setDests(dests.includes(c) ? dests.filter((x) => x !== c) : [...dests, c])} />
              {c}
            </label>
          ))}
        </div>
      </Campo>
      <Campo id="af-params" label="Parámetros (JSON)"
             ayuda='Plantilla de la acción — ej: {"template":"lost_signal","destinatarios":["+569…"]}'>
        <TextInput id="af-params" sizing="sm" className="font-mono" value={params}
                   onChange={(e) => setParams(e.target.value)} />
      </Campo>
      <div className="flex items-center gap-2">
        <button onClick={() => void guardar()} disabled={guardando}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50">
          {guardando ? "Guardando…" : "Guardar automatismo"}
        </button>
        <button onClick={onCerrar} className="text-xs text-gray-500 hover:underline">Cancelar</button>
      </div>
    </div>
  );
}


function SeccionRecurrencias({ det, ruleId, editable, onMsg, onCambio }: {
  det: Detalle; ruleId: number; editable: boolean;
  onMsg: (m: string) => void; onCambio: () => void;
}) {
  const [filas, setFilas] = useState<Recurrencia[]>(det.recurrencias ?? []);
  const [noContesta, setNoContesta] = useState(det.esc_no_contesta ?? "");
  const [sucio, setSucio] = useState(false);

  const guardar = async () => {
    const res = await post("fn_pt4_save_recurrencias", {
      p_rule_id: ruleId, p_recurrencias: filas,
      p_esc_no_contesta: noContesta || null, p_actor: "app-ficha" });
    if (res?.ok === false) { onMsg(`No guardado — ${res?.detalle ?? res?.error}`); return; }
    setSucio(false);
    onMsg("Recurrencias guardadas (auditadas).");
    onCambio();
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
      {filas.map((f, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-gray-500 dark:text-gray-400">Si se repite</span>
          <DsSelect sizing="sm" value={f.condicion} disabled={!editable}
                  onChange={(e) => { const c = [...filas]; c[i] = { ...c[i], condicion: e.target.value }; setFilas(c); setSucio(true); }}>
            {REC_CONDICIONES.map((x) => <option key={x} value={x}>{x}</option>)}
          </DsSelect>
          <span className="text-[12px] text-gray-500 dark:text-gray-400">→</span>
          <DsSelect sizing="sm" value={f.accion} disabled={!editable}
                  onChange={(e) => { const c = [...filas]; c[i] = { ...c[i], accion: e.target.value }; setFilas(c); setSucio(true); }}>
            {ESC_ACCIONES.map((x) => <option key={x} value={x}>{x}</option>)}
          </DsSelect>
          {editable && (
            <button className="text-gray-400 hover:text-red-500 px-1"
                    onClick={() => { setFilas(filas.filter((_, j) => j !== i)); setSucio(true); }}>✕</button>
          )}
        </div>
      ))}
      {filas.length === 0 && (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          Sin reglas de recurrencia — el síntoma no escala por repetición.
        </p>
      )}
      <div className="flex items-end gap-3 flex-wrap pt-1">
        {editable && (
          <button className="text-[11.5px] font-bold text-blue-600 border border-dashed border-blue-300 rounded-md px-3 py-1.5"
                  onClick={() => { setFilas([...filas, { condicion: REC_CONDICIONES[0], accion: ESC_ACCIONES[0] }]); setSucio(true); }}>
            ＋ Agregar regla de recurrencia
          </button>
        )}
        <div className="ml-auto">
          <Campo id="rec-nocontesta" label="Si el encargado no contesta">
            <DsSelect id="rec-nocontesta" sizing="sm" value={noContesta} disabled={!editable}
                    onChange={(e) => { setNoContesta(e.target.value); setSucio(true); }}>
              <option value="">—</option>
              {ESC_ACCIONES.map((x) => <option key={x} value={x}>{x}</option>)}
            </DsSelect>
          </Campo>
        </div>
        {editable && sucio && (
          <button className="text-[12px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md px-4 py-2"
                  onClick={() => void guardar()}>Guardar</button>
        )}
      </div>
    </div>
  );
}

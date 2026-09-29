"use client";

// X6a · Fuentes de condición — CAPA DECLARATIVA (decisión Erick 2026-08-08:
// cerrar lo declarativo y el front; el procesamiento y la evaluación quedan
// como plan documentado en propuesta_fuentes_condiciones.md §5).
// Una fuente referencia un Data Source del Coordinador (las credenciales
// viven allá) y declara la llave de cruce con la flota y los CAMPOS que
// aporta al editor de criterios de la ficha del síntoma.
import { useState } from "react";
import useSWR from "swr";
import { Label, TextInput, Select as DsSelect, ToggleSwitch } from "flowbite-react";
import { Campo } from "./ficha-sintoma";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});
const post = (fn: string, body: Record<string, unknown>) =>
  fetch(`/app/api/atc/rpc/${fn}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }).then((r) => r.json());

type CampoFuente = { field_key: string; label: string; unidad: string | null; tipo: string; operadores: string[] };
type Fuente = {
  source_key: string; nombre: string; descripcion: string | null;
  data_source_id: string | null; data_source_nombre: string | null;
  endpoint: string | null; join_key: string; refresh: string;
  historico: boolean; activo: boolean; campos: CampoFuente[];
};

const JOIN_LABEL: Record<string, string> = {
  patente: "Patente", asset_id: "Asset ID", conductor_rut: "RUT conductor", trip_id: "Viaje",
};
const VACIA = {
  source_key: "", nombre: "", descripcion: "", data_source_id: "", data_source_nombre: "",
  endpoint: "", join_key: "patente", refresh: "cache_15min", historico: false,
  campos: [] as { field_key: string; label: string; unidad: string; tipo: string }[],
};

export default function FuentesCondicion({ carrierMode }: { carrierMode: boolean }) {
  const { data: fuentes, mutate } = useSWR<Fuente[]>(
    "/app/api/atc/rpc/fn_pt4_condition_sources", fetcher);
  const [form, setForm] = useState<typeof VACIA | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!form) return;
    setGuardando(true); setMsg(null);
    const res = await post("fn_pt4_save_condition_source", {
      p_source_key: form.source_key || null, p_nombre: form.nombre,
      p_descripcion: form.descripcion || null,
      p_data_source_id: form.data_source_id || null,
      p_data_source_nombre: form.data_source_nombre || null,
      p_endpoint: form.endpoint || null, p_join_key: form.join_key,
      p_refresh: form.refresh, p_historico: form.historico,
      p_activo: true,
      p_campos: form.campos.filter((c) => c.label.trim()),
      p_actor: "app-settings" });
    setGuardando(false);
    if (res?.ok === false) { setMsg(`No guardado — ${res?.detalle ?? res?.error}`); return; }
    setForm(null); void mutate();
    setMsg("Fuente declarada (auditada). Sus campos ya aparecen en el editor de criterios de las fichas.");
  };

  const editar = (f: Fuente) => setForm({
    source_key: f.source_key, nombre: f.nombre, descripcion: f.descripcion ?? "",
    data_source_id: f.data_source_id ?? "", data_source_nombre: f.data_source_nombre ?? "",
    endpoint: f.endpoint ?? "", join_key: f.join_key, refresh: f.refresh,
    historico: f.historico,
    campos: f.campos.map((c) => ({ field_key: c.field_key, label: c.label,
      unidad: c.unidad ?? "", tipo: c.tipo })),
  });

  return (
    <div className="space-y-4 pb-16">
      <div className="flex items-start gap-3 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[62em]">
          Las fuentes declaradas aportan <b>campos al editor de criterios</b> de cada síntoma —
          además de la señal tradicional del equipo. Las credenciales viven en{" "}
          <b>Configuración → Data Sources</b>; aquí solo se referencia la fuente y se declara
          cómo se cruza con la flota.
        </p>
        <span className="flex-1" />
        {!carrierMode && (
          <button onClick={() => { setForm({ ...VACIA }); setMsg(null); }}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5">
            + Declarar fuente
          </button>
        )}
      </div>
      <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-[12.5px] text-amber-800 dark:text-amber-300">
        <b>Capa declarativa.</b> El procesamiento (traer el dato a la base) y la evaluación
        (usarlo en el motor) están planificados y documentados — aún no ejecutan. Los criterios
        que usen estos campos quedan definidos y listos para cuando el procesamiento se implemente.
      </div>

      {carrierMode && (
        <p className="text-sm text-gray-500">Las fuentes de condición las declara la operación — vista de solo lectura.</p>
      )}

      {form && !carrierMode && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {form.source_key ? "Editar fuente" : "Nueva fuente de condición"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Campo id="fc-nombre" label="Nombre *">
              <TextInput id="fc-nombre" sizing="sm" value={form.nombre}
                         onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </Campo>
            <Campo id="fc-descr" label="Descripción">
              <TextInput id="fc-descr" sizing="sm" value={form.descripcion}
                         onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </Campo>
            <Campo id="fc-join" label="Se cruza con la flota por *"
                   ayuda="La llave que une el dato externo con el equipo/viaje">
              <DsSelect id="fc-join" sizing="sm" value={form.join_key}
                        onChange={(e) => setForm({ ...form, join_key: e.target.value })}>
                {Object.entries(JOIN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </DsSelect>
            </Campo>
            <Campo id="fc-ds" label="Data Source (id)"
                   ayuda="Referencia — las credenciales viven en Data Sources">
              <TextInput id="fc-ds" sizing="sm" value={form.data_source_id}
                         onChange={(e) => setForm({ ...form, data_source_id: e.target.value })} />
            </Campo>
            <Campo id="fc-dsn" label="Data Source (nombre visible)">
              <TextInput id="fc-dsn" sizing="sm" value={form.data_source_nombre}
                         onChange={(e) => setForm({ ...form, data_source_nombre: e.target.value })} />
            </Campo>
            <Campo id="fc-ep" label="Endpoint / función"
                   ayuda="Vista o función del OpenAPI de la fuente">
              <TextInput id="fc-ep" sizing="sm" value={form.endpoint}
                         onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
            </Campo>
            <Campo id="fc-refresh" label="Frescura del dato"
                   ayuda="Cada cuánto se refrescará al implementarse el procesamiento">
              <DsSelect id="fc-refresh" sizing="sm" value={form.refresh}
                        onChange={(e) => setForm({ ...form, refresh: e.target.value })}>
                <option value="on_event">En cada evento</option>
                <option value="cache_5min">Cada 5 minutos</option>
                <option value="cache_15min">Cada 15 minutos</option>
                <option value="cache_60min">Cada hora</option>
              </DsSelect>
            </Campo>
            <div className="pt-5">
              <ToggleSwitch checked={form.historico} label="La fuente tiene historia"
                            onChange={() => setForm({ ...form, historico: !form.historico })} />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Con historia sus campos podrán backtestearse
              </p>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-[1fr_1fr_110px_120px_70px] gap-2 mb-1">
              <Label className="text-[11px] text-gray-500">Campo (etiqueta) *</Label>
              <Label className="text-[11px] text-gray-500">Clave técnica</Label>
              <Label className="text-[11px] text-gray-500">Unidad</Label>
              <Label className="text-[11px] text-gray-500">Tipo</Label>
              <span />
            </div>
            {form.campos.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_110px_120px_70px] gap-2 items-center mb-1.5">
                <TextInput sizing="sm" value={c.label} aria-label="Etiqueta del campo"
                           onChange={(e) => setForm({ ...form, campos: form.campos.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                <TextInput sizing="sm" className="font-mono" value={c.field_key} aria-label="Clave técnica"
                           onChange={(e) => setForm({ ...form, campos: form.campos.map((x, j) => j === i ? { ...x, field_key: e.target.value } : x) })} />
                <TextInput sizing="sm" value={c.unidad} aria-label="Unidad"
                           onChange={(e) => setForm({ ...form, campos: form.campos.map((x, j) => j === i ? { ...x, unidad: e.target.value } : x) })} />
                <DsSelect sizing="sm" value={c.tipo} aria-label="Tipo"
                          onChange={(e) => setForm({ ...form, campos: form.campos.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x) })}>
                  <option value="numero">Número</option><option value="texto">Texto</option>
                  <option value="booleano">Sí / No</option><option value="fecha">Fecha</option>
                </DsSelect>
                <button className="text-xs text-red-600"
                        onClick={() => setForm({ ...form, campos: form.campos.filter((_, j) => j !== i) })}>
                  quitar
                </button>
              </div>
            ))}
            <button className="text-xs text-blue-600 hover:underline"
                    onClick={() => setForm({ ...form, campos: [...form.campos, { field_key: "", label: "", unidad: "", tipo: "numero" }] })}>
              + campo
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => void guardar()}
                    disabled={guardando || !form.nombre.trim() || !form.campos.some((c) => c.label.trim())}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50">
              {guardando ? "Guardando…" : "Guardar fuente"}
            </button>
            <button onClick={() => setForm(null)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 text-sm px-3 py-1.5 text-gray-900 dark:text-white">
              Cancelar
            </button>
          </div>
        </section>
      )}
      {msg && <div className="text-sm text-gray-700 dark:text-gray-300">{msg}</div>}

      <div className="grid md:grid-cols-2 gap-3">
        {(fuentes ?? []).map((f) => (
          <div key={f.source_key} className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-sm text-gray-900 dark:text-white">{f.nombre}</b>
              {f.source_key === "senal" ? (
                <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">BASE DEL MOTOR</span>
              ) : (
                <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5"
                      style={{ background: "rgba(28,100,242,.1)", color: "#1C64F2" }}>FUENTE DECLARADA</span>
              )}
              {f.historico && (
                <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5"
                      style={{ background: "rgba(14,159,110,.1)", color: "#0E9F6E" }}>BACKTESTEABLE</span>
              )}
              <span className="flex-1" />
              {!carrierMode && f.source_key !== "senal" && (
                <button className="text-xs text-blue-600 hover:underline" onClick={() => editar(f)}>editar</button>
              )}
            </div>
            <div className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5">
              {f.descripcion}
              {f.data_source_nombre && <> · 🔌 {f.data_source_nombre}</>}
              {f.endpoint && <> · {f.endpoint}</>}
              {" · "}cruce por {JOIN_LABEL[f.join_key] ?? f.join_key} · {f.refresh.replace("cache_", "cada ").replace("min", " min").replace("on_event", "en cada evento")}
            </div>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {f.campos.map((c) => (
                <span key={c.field_key}
                      className="text-[11px] rounded-full border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-gray-700 dark:text-gray-300">
                  {c.label}{c.unidad ? ` (${c.unidad})` : ""}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!fuentes && <div className="text-sm text-gray-500">Cargando fuentes…</div>}
      </div>
    </div>
  );
}

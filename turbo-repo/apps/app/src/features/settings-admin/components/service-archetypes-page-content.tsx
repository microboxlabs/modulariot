"use client";

// Settings › Arquetipos de servicio (capacity-core C1.5) — AQUÍ se define
// el MOLDE de la UO: composición requerida (tractor + N conductores +
// remolque) y requisitos duros (tipo de equipo, licencia). La torre define
// los arquetipos oficiales; el Desk los consume como "Tipo de servicio" y
// el motor ensambla según ellos. (Feedback Erick 2026-07-24: "¿dónde se
// define la UO?").
import { useState } from "react";
import useSWR from "swr";
import { Label, TextInput, Select as DsSelect, ToggleSwitch } from "flowbite-react";
import { HiOutlineCubeTransparent } from "react-icons/hi2";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});
const post = async (fn: string, body: Record<string, unknown>) => {
  const r = await fetch(`/app/api/ams/rpc/${fn}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};

type Arquetipo = {
  archetype_id: number; nombre: string; descripcion: string | null;
  truck_type: string | null; license_cat: string | null;
  n_conductores: number; remolque: string; activo: boolean;
};

const VACIO = { archetype_id: null as number | null, nombre: "", descripcion: "",
  truck_type: "", license_cat: "", n_conductores: 1, remolque: "no" };

const btnPri = "rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50";
const btnSec = "rounded-lg border border-gray-300 dark:border-gray-600 text-sm px-3 py-1.5 text-gray-900 dark:text-white";

function Campo({ id, label, ayuda, children }: {
  id: string; label: string; ayuda?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-sm">{label}</Label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{ayuda}</p>}
    </div>
  );
}

export default function ServiceArchetypesPageContent() {
  const { data: arquetipos, mutate } = useSWR<Arquetipo[]>(
    "/app/api/ams/rpc/fn_cap_archetypes", fetcher);
  const [form, setForm] = useState<typeof VACIO | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const guardar = async () => {
    if (!form) return;
    setBusy(true); setMsg(null);
    const { data } = await post("fn_cap_save_archetype", {
      p_archetype_id: form.archetype_id,
      p_nombre: form.nombre, p_descripcion: form.descripcion || null,
      p_truck_type: form.truck_type || null, p_license_cat: form.license_cat || null,
      p_n_conductores: form.n_conductores, p_remolque: form.remolque,
      p_actor: "app-settings",
    });
    setBusy(false);
    if (data?.ok === false) {
      setMsg(data.error === "solo_torre"
        ? "Los arquetipos oficiales los define la operación."
        : `No guardado — ${data.error}`);
      return;
    }
    setForm(null); void mutate();
  };

  const toggleActivo = async (a: Arquetipo) => {
    await post("fn_cap_save_archetype", {
      p_archetype_id: a.archetype_id, p_nombre: a.nombre,
      p_descripcion: a.descripcion, p_truck_type: a.truck_type,
      p_license_cat: a.license_cat, p_n_conductores: a.n_conductores,
      p_remolque: a.remolque, p_activo: !a.activo, p_actor: "app-settings",
    });
    void mutate();
  };

  return (
    <div className="h-full overflow-y-auto w-full">
    <div className="p-4 xl:px-8 flex flex-col gap-3 w-full max-w-5xl pb-10">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700">
          <HiOutlineCubeTransparent className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </span>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Arquetipos de servicio
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            El molde de la Unidad Operacional: qué composición y requisitos
            exige cada tipo de servicio. El Desk de capacidad los usa para
            ensamblar combinaciones.
          </p>
        </div>
        <button className={btnPri} onClick={() => { setForm({ ...VACIO }); setMsg(null); }}>
          + Nuevo arquetipo
        </button>
      </div>

      {form && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Campo id="arq-nombre" label="Nombre *">
              <TextInput id="arq-nombre" sizing="sm" value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </Campo>
            <Campo id="arq-desc" label="Descripción">
              <TextInput id="arq-desc" sizing="sm" value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </Campo>
            <Campo id="arq-equipo" label="Tipo de equipo" ayuda="Vacío = cualquiera">
              <DsSelect id="arq-equipo" sizing="sm" value={form.truck_type}
                onChange={(e) => setForm({ ...form, truck_type: e.target.value })}>
                <option value="">Cualquiera</option>
                <option value="rampla">Rampla</option><option value="tolva">Tolva</option>
                <option value="cama_baja">Cama baja</option><option value="sider">Sider</option>
                <option value="tracto">Tracto</option>
              </DsSelect>
            </Campo>
            <Campo id="arq-lic" label="Licencia requerida" ayuda="Vacío = cualquiera">
              <DsSelect id="arq-lic" sizing="sm" value={form.license_cat}
                onChange={(e) => setForm({ ...form, license_cat: e.target.value })}>
                <option value="">Cualquiera</option>
                <option value="A2">A2</option><option value="A3">A3</option>
                <option value="A4">A4</option><option value="A5">A5</option>
              </DsSelect>
            </Campo>
            <Campo id="arq-nc" label="Conductores" ayuda="Doble conductor para relevos">
              <DsSelect id="arq-nc" sizing="sm" value={form.n_conductores}
                onChange={(e) => setForm({ ...form, n_conductores: Number(e.target.value) })}>
                <option value={1}>1 conductor</option>
                <option value={2}>2 conductores (relevo)</option>
              </DsSelect>
            </Campo>
            <Campo id="arq-rem" label="Remolque">
              <DsSelect id="arq-rem" sizing="sm" value={form.remolque}
                onChange={(e) => setForm({ ...form, remolque: e.target.value })}>
                <option value="no">No lleva</option>
                <option value="opcional">Opcional</option>
                <option value="obligatorio">Obligatorio</option>
              </DsSelect>
            </Campo>
          </div>
          <div className="flex gap-2">
            <button className={btnPri} disabled={busy || !form.nombre.trim()}
                    onClick={() => void guardar()}>
              {busy ? "Guardando…" : form.archetype_id ? "Guardar cambios" : "Crear arquetipo"}
            </button>
            <button className={btnSec} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </section>
      )}
      {msg && <div className="text-sm text-red-600 dark:text-red-400">{msg}</div>}

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th className="px-4 py-2.5 font-medium">Arquetipo</th>
              <th className="px-4 py-2.5 font-medium">Composición de la UO</th>
              <th className="px-4 py-2.5 font-medium">Requisitos</th>
              <th className="px-4 py-2.5 font-medium">Activo</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {(arquetipos ?? []).map((a) => (
              <tr key={a.archetype_id}
                  className="border-b border-gray-100 dark:border-gray-700/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-900 dark:text-white">{a.nombre}</div>
                  {a.descripcion && (
                    <div className="text-xs text-gray-500">{a.descripcion}</div>)}
                </td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                  tractor + {a.n_conductores} conductor{a.n_conductores > 1 ? "es" : ""}
                  {a.remolque !== "no" && ` + remolque ${a.remolque}`}
                </td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 text-xs">
                  {[a.truck_type && `equipo ${a.truck_type}`, a.license_cat && `licencia ${a.license_cat}`]
                    .filter(Boolean).join(" · ") || "sin requisitos extra"}
                </td>
                <td className="px-4 py-2.5">
                  <ToggleSwitch checked={a.activo} onChange={() => void toggleActivo(a)} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button className="text-xs text-blue-600 hover:underline"
                    onClick={() => { setMsg(null); setForm({
                      archetype_id: a.archetype_id, nombre: a.nombre,
                      descripcion: a.descripcion ?? "", truck_type: a.truck_type ?? "",
                      license_cat: a.license_cat ?? "", n_conductores: a.n_conductores,
                      remolque: a.remolque }); }}>
                    editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(arquetipos ?? []).length && (
          <div className="p-4 text-sm text-gray-500">Sin arquetipos definidos.</div>)}
      </section>
    </div>
    </div>
  );
}

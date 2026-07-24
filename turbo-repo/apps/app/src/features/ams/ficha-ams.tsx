"use client";

// AMS mantenedores v1 — Ficha editable de camión/colaborador (propuesta
// aprobada 2026-07-23). Se monta dentro de los DETALLES existentes:
// el formulario ES el detalle en modo edición (lápiz por sección).
// Secciones: Identificación (editable) · Acreditación y documentos
// (semáforo + faltantes) · Asignación (tarjeta de dupla, no-elegibles
// atenuados CON MOTIVO, regla "manda el viaje") · Auditoría.
// Tenant server-side vía /api/ams/rpc/*; sin marcas de fuente (agnóstico).
import { useMemo, useState } from "react";
import useSWR, { mutate as swrMutate } from "swr";
import { Label, TextInput, Select as DsSelect } from "flowbite-react";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});
const post = async (fn: string, body: Record<string, unknown>) => {
  const r = await fetch(`/app/api/ams/rpc/${fn}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};

type Acreditacion = {
  acreditado: boolean; bloqueada_por: string[];
  documentos: {
    docs: { doc_id: number; doc_type: string; label: string | null; required: boolean;
      filename: string | null; valid_until: string | null; estado: string;
      uploaded_by: string; created_at: string }[];
    faltantes: { doc_type: string; label: string }[];
  };
};
export type AmsTruck = {
  id: string; license_plate: string; vin: string | null; truck_type: string | null;
  max_weight: number | null; description: string | null; status: string;
  carrier_rut: string | null; external_id: string | null; source_system: string;
  updated_at: string; conductor: { id: string; nombre: string; rut: string; desde: string } | null;
  acreditacion: Acreditacion;
};
export type AmsDriver = {
  id: string; full_name: string; rut: string; phone: string | null;
  license_category: string | null; license_expires: string | null; status: string;
  carrier_rut: string | null; external_id: string | null; source_system: string;
  updated_at: string; camion: { id: string; patente: string; desde: string } | null;
  acreditacion: Acreditacion;
};

const EST_DOC: Record<string, { label: string; cls: string }> = {
  vigente: { label: "Vigente", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  por_vencer: { label: "Por vencer", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  urgente: { label: "Urgente", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  vencido: { label: "Vencido", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  sin_vencimiento: { label: "Sin vencimiento", cls: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
};
const DOC_TYPES: Record<"TRUCK" | "DRIVER", { v: string; l: string }[]> = {
  TRUCK: [
    { v: "rev_tecnica", l: "Revisión técnica" }, { v: "soap", l: "Seguro obligatorio (SOAP)" },
    { v: "permiso_circulacion", l: "Permiso de circulación" }, { v: "padron", l: "Padrón" }],
  DRIVER: [
    { v: "licencia", l: "Licencia de conducir" }, { v: "examen_ocupacional", l: "Examen ocupacional" },
    { v: "credencial_faena", l: "Credencial de faena" }, { v: "contrato", l: "Contrato" }],
};

const inp = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white";

// ── Estándar de formularios del app: label visible, requerido marcado,
// ayuda y error POR CAMPO (patrón settings-form-field + FormSection) ──
function Campo({ id, label, requerido, ayuda, error, children }: {
  id: string; label: string; requerido?: boolean; ayuda?: string;
  error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-sm">
        {label}{requerido && <span className="text-red-600 ml-0.5">*</span>}
      </Label>
      {children}
      {ayuda && !error && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{ayuda}</p>)}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>)}
    </div>
  );
}

function TituloBloque({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {children}
      </span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// Validaciones de dominio (calidad: se valida ANTES de llamar al backend)
function rutValido(rut: string): boolean {
  const limpio = rut.replace(/\./g, "").replace("-", "").toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;
  const cuerpo = limpio.slice(0, -1); const dv = limpio.slice(-1);
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul; mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (suma % 11);
  const dvCalc = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return dv === dvCalc;
}
const patenteValida = (p: string) => /^[A-Z0-9]{5,8}$/.test(p.trim().toUpperCase());
const btnPri = "rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50";
const btnSec = "rounded-lg border border-gray-300 dark:border-gray-600 text-sm px-3 py-1.5 text-gray-900 dark:text-white";

function Seccion({ titulo, extra, children }: {
  titulo: string; extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{titulo}</h3>
        {extra}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function BadgeAcreditacion({ a }: { a: Acreditacion }) {
  if (a.acreditado) return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
      ● Acreditado
    </span>);
  const motivo = a.bloqueada_por.map((b) =>
    b === "documentos" ? "documentos" : "fuente externa").join(" + ");
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
          title={`Bloqueada por: ${motivo}`}>
      ● No acreditado · {motivo}
    </span>);
}

export function FichaAms({ tipo, matchId, matchName, defaults, crear }: {
  tipo: "TRUCK" | "DRIVER";
  /** modo alta directa (botón «+ Nuevo» de las listas) */
  crear?: boolean;
  /** patente (TRUCK) o RUT (DRIVER) para enlazar con el registro AMS */
  matchId?: string;
  /** fallback de enlace por nombre (expedientes sin RUT) */
  matchName?: string;
  /** prellenado al crear (p.ej. nombre desde el expediente) */
  defaults?: Record<string, string>;
}) {
  const listFn = tipo === "TRUCK" ? "fn_ams_trucks" : "fn_ams_drivers";
  const { data: lista, mutate } = useSWR<(AmsTruck | AmsDriver)[]>(
    `/app/api/ams/rpc/${listFn}`, fetcher);
  const rec = useMemo(() => {
    if (!lista) return undefined;
    const m = matchId?.toUpperCase();
    const n = matchName?.toUpperCase();
    return lista.find((r) => (tipo === "TRUCK"
      ? !!m && (r as AmsTruck).license_plate?.toUpperCase() === m
      : (!!m && (r as AmsDriver).rut?.toUpperCase() === m)
        || (!!n && (r as AmsDriver).full_name?.toUpperCase() === n)));
  }, [lista, matchId, matchName, tipo]);

  const [editando, setEditando] = useState(false);
  const [creando, setCreando] = useState(!!crear);
  const [form, setForm] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setCampo = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrores((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const abrirEdicion = () => {
    if (!rec) return;
    setForm(tipo === "TRUCK" ? {
      license_plate: (rec as AmsTruck).license_plate ?? "",
      truck_type: (rec as AmsTruck).truck_type ?? "",
      vin: (rec as AmsTruck).vin ?? "",
      max_weight: (rec as AmsTruck).max_weight?.toString() ?? "",
      description: (rec as AmsTruck).description ?? "",
      status: rec.status ?? "active",
    } : {
      full_name: (rec as AmsDriver).full_name ?? "",
      rut: (rec as AmsDriver).rut ?? "",
      phone: (rec as AmsDriver).phone ?? "",
      license_category: (rec as AmsDriver).license_category ?? "",
      license_expires: (rec as AmsDriver).license_expires?.slice(0, 10) ?? "",
      status: rec.status ?? "active",
    });
    setEditando(true); setMsg(null);
  };
  const abrirCreacion = () => {
    setForm(tipo === "TRUCK"
      ? { license_plate: matchId ?? "", truck_type: "", status: "active", ...(defaults ?? {}) }
      : { full_name: defaults?.full_name ?? matchName ?? "", rut: matchId ?? "", status: "active", ...(defaults ?? {}) });
    setCreando(true); setMsg(null);
  };

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (tipo === "TRUCK") {
      if (!form.license_plate?.trim()) e.license_plate = "La patente es obligatoria.";
      else if (!patenteValida(form.license_plate)) e.license_plate = "Patente inválida (5-8 caracteres alfanuméricos).";
      if (form.max_weight && (Number(form.max_weight) <= 0 || Number.isNaN(Number(form.max_weight))))
        e.max_weight = "Debe ser un número positivo.";
    } else {
      if (!form.full_name?.trim()) e.full_name = "El nombre es obligatorio.";
      if (!form.rut?.trim()) e.rut = "El RUT es obligatorio.";
      else if (!rutValido(form.rut)) e.rut = "RUT inválido — revisa el dígito verificador.";
      if (form.license_expires && form.license_expires < new Date().toISOString().slice(0, 10) && creando)
        e.license_expires = "La licencia ya está vencida — el recurso nacerá no acreditado.";
    }
    setErrores(e);
    // el aviso de licencia vencida no bloquea (advertencia), el resto sí
    return Object.keys(e).filter((k) => k !== "license_expires").length === 0;
  };

  const guardar = async () => {
    if (!validar()) return;
    setBusy(true); setMsg(null);
    const fn = tipo === "TRUCK" ? "fn_ams_save_truck" : "fn_ams_save_driver";
    const body: Record<string, unknown> = tipo === "TRUCK" ? {
      p_id: creando ? null : rec?.id,
      p_license_plate: form.license_plate || null, p_truck_type: form.truck_type || null,
      p_vin: form.vin || null, p_max_weight: form.max_weight ? Number(form.max_weight) : null,
      p_description: form.description || null, p_status: form.status || "active",
      p_actor: "app-mantenedor",
    } : {
      p_id: creando ? null : rec?.id,
      p_full_name: form.full_name || null, p_rut: form.rut || null,
      p_phone: form.phone || null, p_license_category: form.license_category || null,
      p_license_expires: form.license_expires || null, p_status: form.status || "active",
      p_actor: "app-mantenedor",
    };
    const { data } = await post(fn, body);
    setBusy(false);
    if (data?.ok === false) { setMsg(`No guardado — ${data?.detalle ?? data?.error}`); return; }
    setMsg(creando
      ? (data?.aviso_facturacion
          ? "Creado. Este recurso se suma al monitoreo y a la facturación del servicio."
          : "Creado.")
      : "Guardado (auditado).");
    setEditando(false); setCreando(false); void mutate();
    // refrescar las listas que hacen merge con el maestro
    void swrMutate((k) => typeof k === "string" &&
      (k.includes("/api/fleet/trucks") || k.includes("/api/collaborators") || k.includes("/api/ams/rpc/")));
  };

  const enForma = editando || creando;

  if (!lista) return <div className="text-sm text-gray-500 p-2">Cargando ficha AMS…</div>;

  // Sin registro en el maestro: invitación a crear (prellenado)
  if (!rec && !creando && crear) {
    return (
      <Seccion titulo={tipo === "TRUCK" ? "Nuevo camión" : "Nuevo colaborador"}>
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
          <span className="flex-1">{msg ?? "Listo."}</span>
          <button className={btnSec} onClick={abrirCreacion}>Crear otro</button>
        </div>
      </Seccion>
    );
  }
  if (!rec && !creando) {
    return (
      <Seccion titulo={tipo === "TRUCK" ? "Ficha del camión (mantenedor)" : "Ficha del colaborador (mantenedor)"}>
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
          <span className="flex-1">Este recurso aún no tiene ficha en el maestro. Créala para gestionar sus datos, documentos y asignación.</span>
          <button className={btnPri} onClick={abrirCreacion}>Crear ficha</button>
        </div>
        {msg && <div className="text-xs pt-2 text-gray-600 dark:text-gray-300">{msg}</div>}
      </Seccion>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Identificación (editable) ── */}
      <Seccion titulo={tipo === "TRUCK" ? "Ficha del camión (mantenedor)" : "Ficha del colaborador (mantenedor)"}
        extra={<>
          {rec && <BadgeAcreditacion a={rec.acreditacion} />}
          {!enForma && rec && (
            <button className="text-xs text-blue-600 hover:underline" onClick={abrirEdicion}>✎ editar</button>)}
        </>}>
        {!enForma && rec && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            {(tipo === "TRUCK" ? [
              ["Patente", (rec as AmsTruck).license_plate],
              ["Tipo", (rec as AmsTruck).truck_type ?? "—"],
              ["VIN/Chasis", (rec as AmsTruck).vin ?? "—"],
              ["Peso máx.", (rec as AmsTruck).max_weight ? `${(rec as AmsTruck).max_weight} kg` : "—"],
              ["Descripción", (rec as AmsTruck).description ?? "—"],
              ["Estado", rec.status],
              ["Transportista", rec.carrier_rut ?? "operación"],
            ] : [
              ["Nombre", (rec as AmsDriver).full_name],
              ["RUT", (rec as AmsDriver).rut],
              ["Teléfono", (rec as AmsDriver).phone ?? "—"],
              ["Licencia", (rec as AmsDriver).license_category ?? "—"],
              ["Vence", (rec as AmsDriver).license_expires?.slice(0, 10) ?? "—"],
              ["Estado", rec.status],
              ["Transportista", rec.carrier_rut ?? "operación"],
            ]).map(([k, v]) => (
              <div key={k as string}>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{k}</div>
                <div className="text-gray-900 dark:text-white">{v as string}</div>
              </div>
            ))}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Origen del dato</div>
              <div className="text-gray-900 dark:text-white">
                {rec.source_system === "app" ? "editado en el app" : "fuente externa"}
                <span className="text-xs text-gray-500"> · {new Date(rec.updated_at).toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>
        )}
        {enForma && (
          <div className="space-y-4">
            <TituloBloque>Identificación</TituloBloque>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tipo === "TRUCK" ? (<>
                <Campo id="ams-plate" label="Patente" requerido error={errores.license_plate}
                       ayuda="Formato chileno, sin guiones (p. ej. ABCD12)">
                  <TextInput id="ams-plate" sizing="sm" color={errores.license_plate ? "failure" : "gray"}
                    value={form.license_plate ?? ""} disabled={!creando}
                    onChange={(e) => setCampo("license_plate", e.target.value.toUpperCase())} />
                </Campo>
                <Campo id="ams-type" label="Tipo de equipo">
                  <DsSelect id="ams-type" sizing="sm" value={form.truck_type ?? ""}
                    onChange={(e) => setCampo("truck_type", e.target.value)}>
                    <option value="">Seleccionar…</option>
                    <option value="rampla">Rampla</option>
                    <option value="tolva">Tolva</option>
                    <option value="cama_baja">Cama baja</option>
                    <option value="sider">Sider</option>
                    <option value="tracto">Tracto</option>
                    <option value="otro">Otro</option>
                  </DsSelect>
                </Campo>
                <Campo id="ams-vin" label="VIN / N° de chasis">
                  <TextInput id="ams-vin" sizing="sm" value={form.vin ?? ""}
                    onChange={(e) => setCampo("vin", e.target.value)} />
                </Campo>
                <Campo id="ams-weight" label="Peso máximo (kg)" error={errores.max_weight}>
                  <TextInput id="ams-weight" sizing="sm" type="number" min="0"
                    color={errores.max_weight ? "failure" : "gray"}
                    value={form.max_weight ?? ""}
                    onChange={(e) => setCampo("max_weight", e.target.value)} />
                </Campo>
                <Campo id="ams-desc" label="Descripción" ayuda="Marca, modelo u observación operacional">
                  <TextInput id="ams-desc" sizing="sm" value={form.description ?? ""}
                    onChange={(e) => setCampo("description", e.target.value)} />
                </Campo>
              </>) : (<>
                <Campo id="ams-name" label="Nombre completo" requerido error={errores.full_name}>
                  <TextInput id="ams-name" sizing="sm" color={errores.full_name ? "failure" : "gray"}
                    value={form.full_name ?? ""}
                    onChange={(e) => setCampo("full_name", e.target.value)} />
                </Campo>
                <Campo id="ams-rut" label="RUT" requerido error={errores.rut}
                       ayuda="Con guion y dígito verificador (p. ej. 12345678-5)">
                  <TextInput id="ams-rut" sizing="sm" color={errores.rut ? "failure" : "gray"}
                    value={form.rut ?? ""} disabled={!creando}
                    onChange={(e) => setCampo("rut", e.target.value)} />
                </Campo>
                <Campo id="ams-phone" label="Teléfono de contacto">
                  <TextInput id="ams-phone" sizing="sm" type="tel" placeholder="+56 9 …"
                    value={form.phone ?? ""}
                    onChange={(e) => setCampo("phone", e.target.value)} />
                </Campo>
                <Campo id="ams-lic" label="Categoría de licencia">
                  <DsSelect id="ams-lic" sizing="sm" value={form.license_category ?? ""}
                    onChange={(e) => setCampo("license_category", e.target.value)}>
                    <option value="">Seleccionar…</option>
                    <option value="A2">A2</option><option value="A3">A3</option>
                    <option value="A4">A4</option><option value="A5">A5</option>
                    <option value="B">B</option>
                  </DsSelect>
                </Campo>
                <Campo id="ams-lic-exp" label="Vencimiento de licencia" error={errores.license_expires}
                       ayuda="Alimenta el semáforo de acreditación (30/15/0 días)">
                  <TextInput id="ams-lic-exp" sizing="sm" type="date"
                    color={errores.license_expires ? "failure" : "gray"}
                    value={form.license_expires ?? ""}
                    onChange={(e) => setCampo("license_expires", e.target.value)} />
                </Campo>
              </>)}
              <Campo id="ams-status" label="Estado operacional">
                <DsSelect id="ams-status" sizing="sm" value={form.status ?? "active"}
                  onChange={(e) => setCampo("status", e.target.value)}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo (fuera de planificación)</option>
                  {tipo === "TRUCK" && <option value="maintenance">En taller</option>}
                </DsSelect>
              </Campo>
            </div>
            {creando && (
              <div className="flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <span aria-hidden>ⓘ</span>
                <span>Al crear este recurso se suma al monitoreo y a la <b>facturación del servicio</b>.</span>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button className={btnPri} disabled={busy} onClick={() => void guardar()}>
                {busy ? "Guardando…" : creando ? (tipo === "TRUCK" ? "Crear camión" : "Crear colaborador") : "Guardar cambios"}
              </button>
              <button className={btnSec} onClick={() => { setEditando(false); setCreando(false); setErrores({}); }}>Cancelar</button>
            </div>
          </div>
        )}
        {msg && <div className="text-xs pt-2 text-gray-600 dark:text-gray-300">{msg}</div>}
      </Seccion>

      {rec && <SeccionDocs tipo={tipo} rec={rec} onChange={() => void mutate()} />}
      {rec && <SeccionDupla tipo={tipo} rec={rec} onChange={() => void mutate()} />}
      {rec && <SeccionGxc tipo={tipo} rec={rec} />}
      {rec && <SeccionAuditoria tipo={tipo} recId={rec.id} />}
    </div>
  );
}

// ── Documentos: semáforo + faltantes + alta tipada ──
function SeccionDocs({ tipo, rec, onChange }: {
  tipo: "TRUCK" | "DRIVER"; rec: AmsTruck | AmsDriver; onChange: () => void;
}) {
  const docs = rec.acreditacion.documentos;
  const [dt, setDt] = useState(""); const [venc, setVenc] = useState("");
  const [file, setFile] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);

  const subir = async () => {
    if (!dt) { setMsg("Elige el tipo de documento."); return; }
    setBusy(true);
    const { data } = await post("fn_ams_save_doc", {
      p_resource_type: tipo, p_resource_id: rec.id, p_doc_type: dt,
      p_filename: file || null, p_valid_until: venc || null, p_actor: "app-mantenedor" });
    setBusy(false);
    setMsg(data?.ok === false ? `No guardado — ${data?.detalle ?? data?.error}` : null);
    if (data?.ok) { setDt(""); setVenc(""); setFile(""); onChange(); }
  };
  const borrar = async (docId: number) => {
    if (!window.confirm("¿Eliminar este documento?")) return;
    await post("fn_ams_delete_doc", { p_doc_id: docId, p_actor: "app-mantenedor" });
    onChange();
  };

  return (
    <Seccion titulo="Acreditación y documentos"
      extra={<span className="text-[11px] text-gray-500">obligatorios con ★ · vencimientos 30/15/0</span>}>
      <div className="space-y-1.5">
        {docs.docs.map((d) => (
          <div key={d.doc_id} className="flex items-center gap-2 text-sm">
            <span className="flex-none w-[210px] truncate text-gray-900 dark:text-white">
              {d.required && "★ "}{d.label ?? d.doc_type}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${EST_DOC[d.estado]?.cls ?? ""}`}>
              {EST_DOC[d.estado]?.label ?? d.estado}
            </span>
            <span className="text-xs text-gray-500 flex-1 truncate">
              {d.valid_until ? `vence ${d.valid_until.slice(0, 10)}` : ""}
              {d.filename ? ` · ${d.filename}` : ""} · {d.uploaded_by}
            </span>
            <button className="text-[11px] text-rose-600 hover:underline" onClick={() => void borrar(d.doc_id)}>eliminar</button>
          </div>
        ))}
        {docs.faltantes.map((f) => (
          <div key={f.doc_type} className="flex items-center gap-2 text-sm opacity-70">
            <span className="flex-none w-[210px] truncate text-gray-900 dark:text-white">★ {f.label}</span>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Falta</span>
          </div>
        ))}
        {!docs.docs.length && !docs.faltantes.length && (
          <div className="text-xs text-gray-500">Sin documentos requeridos para este recurso.</div>
        )}
      </div>
      <div className="pt-4 space-y-3">
        <TituloBloque>Registrar documento</TituloBloque>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Campo id="doc-tipo" label="Tipo de documento" requerido>
            <DsSelect id="doc-tipo" sizing="sm" value={dt} onChange={(e) => setDt(e.target.value)}>
              <option value="">Seleccionar…</option>
              {DOC_TYPES[tipo].map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </DsSelect>
          </Campo>
          <Campo id="doc-venc" label="Fecha de vencimiento"
                 ayuda="Alimenta el semáforo y la acreditación">
            <TextInput id="doc-venc" sizing="sm" type="date" value={venc}
                       onChange={(e) => setVenc(e.target.value)} />
          </Campo>
          <Campo id="doc-file" label="Archivo de respaldo"
                 ayuda="Referencia por ahora — la carga a repositorio llega en el siguiente corte">
            <TextInput id="doc-file" sizing="sm" placeholder="revision_tecnica.pdf"
                       value={file} onChange={(e) => setFile(e.target.value)} />
          </Campo>
        </div>
        <button className={btnPri} disabled={busy || !dt} onClick={() => void subir()}>
          {busy ? "Registrando…" : "Registrar documento"}
        </button>
      </div>
      {msg && <div className="text-sm pt-2 text-red-600 dark:text-red-400">{msg}</div>}
    </Seccion>
  );
}

// ── Asignación: tarjeta de dupla + reasignar con candidatos ricos ──
function SeccionDupla({ tipo, rec, onChange }: {
  tipo: "TRUCK" | "DRIVER"; rec: AmsTruck | AmsDriver; onChange: () => void;
}) {
  const [reasignando, setReasignando] = useState(false);
  const [busca, setBusca] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const otroFn = tipo === "TRUCK" ? "fn_ams_drivers" : "fn_ams_trucks";
  const { data: candidatos } = useSWR<(AmsTruck | AmsDriver)[]>(
    reasignando ? `/app/api/ams/rpc/${otroFn}` : null, fetcher);
  const { data: historia } = useSWR<{ driver: string; patente: string; desde: string; hasta: string | null }[]>(
    `/app/api/ams/rpc/fn_ams_link_history?p_resource_type=${tipo}&p_resource_id=${rec.id}`, fetcher);

  const actual = tipo === "TRUCK" ? (rec as AmsTruck).conductor : (rec as AmsDriver).camion;

  const asignar = async (otro: AmsTruck | AmsDriver) => {
    setMsg(null);
    const body = tipo === "TRUCK"
      ? { p_driver_id: otro.id, p_truck_id: rec.id, p_actor: "app-mantenedor" }
      : { p_driver_id: rec.id, p_truck_id: otro.id, p_actor: "app-mantenedor" };
    const { status, data } = await post("fn_ams_link", body);
    if (status === 409) { setMsg(data?.detalle ?? "Viaje en curso — manda el viaje."); return; }
    if (data?.ok === false) { setMsg(`No asignado — ${data?.detalle ?? data?.error}`); return; }
    setReasignando(false); onChange();
  };
  const soltar = async () => {
    if (!actual) return;
    if (!window.confirm("¿Quitar la asignación actual?")) return;
    const body = tipo === "TRUCK"
      ? { p_driver_id: (actual as AmsTruck["conductor"])!.id, p_truck_id: rec.id, p_actor: "app-mantenedor" }
      : { p_driver_id: rec.id, p_truck_id: (actual as AmsDriver["camion"])!.id, p_actor: "app-mantenedor" };
    const { status, data } = await post("fn_ams_unlink", body);
    if (status === 409) { setMsg(data?.detalle ?? "Viaje en curso — manda el viaje."); return; }
    setMsg(null); onChange();
  };

  // Motivo de NO elegibilidad (atenuado, nunca oculto)
  const motivoNoElegible = (c: AmsTruck | AmsDriver): string | null => {
    if (c.status !== "active") return c.status === "maintenance" ? "en taller" : "inactivo";
    if (!c.acreditacion.acreditado) {
      return "no acreditado (" + c.acreditacion.bloqueada_por
        .map((b) => (b === "documentos" ? "documentos" : "fuente externa")).join("+") + ")";
    }
    const yaAsignado = tipo === "TRUCK"
      ? (c as AmsDriver).camion : (c as AmsTruck).conductor;
    if (yaAsignado) {
      return "ya asignado a " + ((c as AmsDriver).camion?.patente ?? (c as AmsTruck).conductor?.nombre ?? "otro recurso");
    }
    return null;
  };

  const filtrados = (candidatos ?? []).filter((c) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    const txt = tipo === "TRUCK"
      ? `${(c as AmsDriver).full_name} ${(c as AmsDriver).rut}`
      : `${(c as AmsTruck).license_plate} ${(c as AmsTruck).truck_type ?? ""}`;
    return txt.toLowerCase().includes(q);
  });

  return (
    <Seccion titulo={tipo === "TRUCK" ? "Conductor asignado" : "Camión asignado"}
      extra={<span className="text-[11px] text-gray-500">con viaje en curso, manda el viaje</span>}>
      {actual ? (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-900 px-3 py-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-sm flex-none">
            {tipo === "TRUCK"
              ? ((actual as AmsTruck["conductor"])!.nombre ?? "?").split(" ").slice(0, 2).map((w) => w[0]).join("")
              : "🚚"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {tipo === "TRUCK" ? (actual as AmsTruck["conductor"])!.nombre : (actual as AmsDriver["camion"])!.patente}
            </div>
            <div className="text-xs text-gray-500">
              {tipo === "TRUCK" && <>{(actual as AmsTruck["conductor"])!.rut} · </>}
              desde {new Date(actual.desde).toLocaleDateString("es-CL")}
            </div>
          </div>
          <button className={btnSec} onClick={() => { setReasignando(!reasignando); setMsg(null); }}>Reasignar</button>
          <button className="text-[11px] text-rose-600 hover:underline" onClick={() => void soltar()}>quitar</button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="flex-1">Sin {tipo === "TRUCK" ? "conductor" : "camión"} asignado.</span>
          <button className={btnPri} onClick={() => { setReasignando(!reasignando); setMsg(null); }}>Asignar</button>
        </div>
      )}

      {reasignando && (
        <div className="pt-3 space-y-1.5">
          <input className={inp} autoFocus
                 placeholder={tipo === "TRUCK" ? "Buscar conductor por nombre o RUT…" : "Buscar camión por patente…"}
                 value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="max-h-[260px] overflow-y-auto space-y-1">
            {filtrados.map((c) => {
              const motivo = motivoNoElegible(c);
              return (
                <button key={c.id} disabled={!!motivo}
                  onClick={() => void asignar(c)}
                  className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                    motivo ? "opacity-45 cursor-not-allowed border-gray-200 dark:border-gray-700"
                           : "border-gray-200 dark:border-gray-700 hover:border-blue-400"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {tipo === "TRUCK" ? (c as AmsDriver).full_name : (c as AmsTruck).license_plate}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {tipo === "TRUCK"
                        ? `${(c as AmsDriver).rut} · lic. ${(c as AmsDriver).license_category ?? "—"}${(c as AmsDriver).license_expires ? ` vence ${(c as AmsDriver).license_expires!.slice(0, 10)}` : ""}`
                        : `${(c as AmsTruck).truck_type ?? "—"}`}
                    </div>
                  </div>
                  {motivo
                    ? <span className="text-[11px] text-rose-600 flex-none">{motivo}</span>
                    : <span className="text-[11px] text-green-600 flex-none">elegible</span>}
                </button>
              );
            })}
            {candidatos && !filtrados.length && (
              <div className="text-xs text-gray-500 px-1">Sin resultados.</div>)}
          </div>
        </div>
      )}
      {msg && (
        <div className="mt-2 text-xs rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
          {msg}
        </div>
      )}

      {(historia ?? []).length > 0 && (
        <div className="pt-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 pb-1">Historial de asignaciones</div>
          <div className="space-y-0.5">
            {(historia ?? []).slice(0, 6).map((h, i) => (
              <div key={i} className="text-xs text-gray-600 dark:text-gray-300">
                {h.driver} ↔ {h.patente} · {new Date(h.desde).toLocaleDateString("es-CL")}
                {h.hasta ? ` → ${new Date(h.hasta).toLocaleDateString("es-CL")}` : " → actual"}
              </div>
            ))}
          </div>
        </div>
      )}
    </Seccion>
  );
}

function SeccionAuditoria({ tipo, recId }: { tipo: "TRUCK" | "DRIVER"; recId: string }) {
  const { data } = useSWR<{ event_type: string; payload: { actor?: string }; created_at: string }[]>(
    `/app/api/ams/rpc/fn_ams_events?p_entity_type=${tipo}&p_entity_id=${recId}&p_limit=15`, fetcher);
  if (!data?.length) return null;
  return (
    <Seccion titulo="Historial de cambios">
      <div className="space-y-1">
        {data.map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span className="rounded-full px-2 py-0.5 bg-gray-100 dark:bg-gray-700 font-medium">{e.event_type}</span>
            <span className="flex-1 truncate">{e.payload?.actor ?? ""}</span>
            <span className="text-gray-500">{new Date(e.created_at).toLocaleString("es-CL")}</span>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

// ── Costura GxC: el standing del recurso alimenta el mantenedor ──
function SeccionGxc({ tipo, rec }: { tipo: "TRUCK" | "DRIVER"; rec: AmsTruck | AmsDriver }) {
  const gxcTipo = tipo === "TRUCK" ? "camion" : "conductor";
  const gxcId = tipo === "TRUCK" ? (rec as AmsTruck).license_plate : (rec as AmsDriver).full_name;
  const { data } = useSWR<{ capitulos: { viajes: number; con_consecuencia: number;
    mix: Record<string, number> } | null; tendencia: { tasa_act: number | null } | null }>(
    `/app/api/gemelo/rpc/fn_dx_gol_gxc_perfil?p_tipo=${gxcTipo}&p_id=${encodeURIComponent(gxcId)}&p_dias=28`,
    fetcher);
  const cap = data?.capitulos;
  if (!cap || !cap.viajes) return null;   // sin historia GxC aún: no se muestra
  const tasa = Math.round((cap.con_consecuencia / Math.max(1, cap.viajes)) * 100);
  return (
    <Seccion titulo="Gestión por consecuencia (28 días)"
      extra={<a className="text-xs text-blue-600 hover:underline"
                href={`/app/es/gxc/${gxcTipo}/${encodeURIComponent(gxcId)}?dias=28`}>
        ver perfil completo →</a>}>
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span className="text-gray-900 dark:text-white">
          <b className={tasa >= 50 ? "text-rose-600" : "text-green-600"}>{tasa}%</b> de {cap.viajes} viajes con consecuencia
        </span>
        <span className="text-xs text-gray-500">
          {Object.entries(cap.mix ?? {}).filter(([, v]) => v > 0)
            .map(([k, v]) => `${k} ${v}`).join(" · ") || "sin consecuencias"}
        </span>
      </div>
    </Seccion>
  );
}

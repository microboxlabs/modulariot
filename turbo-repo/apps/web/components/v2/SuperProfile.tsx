"use client";

import { useMemo, useState } from "react";
import { SYMPTOMS } from "./torre-data";
import { ENTITY_DATA, symDim, DIM_COLOR, type Entity } from "./torre-modules-data";

// ============================================================
// Acto 2 · SuperProfile — la identidad operacional viva de cada entidad.
// Port nativo (Design System) de la sección /torre.html#superprofile.
// Sin score abstracto: nivel, riesgo, historia, comportamiento y plan
// derivados de los síntomas reales de junio 2026.
// ============================================================

const fmt = (n: number) => n.toLocaleString("es-CL");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

// Mapa technicalName → nombre bonito / owner / action.
const byTech = Object.fromEntries(SYMPTOMS.map((s) => [s.technicalName, s]));
const nice = (t: string) => byTech[t]?.name || t;

const ARCH: [string, string][] = [
  ["Identidad", "Datos maestros, relaciones, documentos y contexto de la entidad."],
  ["Estado actual", "Nivel operacional, riesgo, restricciones, habilitaciones y alertas abiertas."],
  ["Historia operacional", "Eventos, síntomas, tratamientos, viajes, cambios de estado y evidencia."],
  ["Comportamiento observado", "Seguridad, cumplimiento, eficiencia, confiabilidad, disponibilidad, trazabilidad."],
  ["Patrones", "Recurrencias, concentración por hora/zona/proveedor/proceso y anomalías."],
  ["Planes de mejora", "Acción correctiva/preventiva, dueño, fecha, verificación y resultado."],
];

const ENTS: [string, string, string][] = [
  ["SuperProfile Conductor", "Persona operacional", "¿Opera de forma segura, cumplidora y consistente?"],
  ["SuperProfile Transportista", "Empresa / proveedor", "¿Qué tan confiable es como proveedor operacional?"],
  ["SuperProfile Camión / Activo", "Activo", "¿Está disponible, trazable y apto para operar?"],
  ["SuperProfile Operación", "Terminal / área", "¿Funciona dentro del estándar de flujo y seguridad?"],
  ["SuperProfile Ruta", "Corredor", "¿Qué nivel de riesgo y confiabilidad tiene el corredor?"],
];

const CYCLE: [string, string][] = [
  ["Ver", "Recolectar señales, síntomas, eventos, tratamientos y evidencia."],
  ["Entender", "Contextualizar por entidad, ruta, horario, zona, responsable y recurrencia."],
  ["Actuar", "Asignar responsable, SLA, tarea, decisión y cierre trazable."],
  ["Resolver", "Causa probable, control faltante y plan correctivo/preventivo."],
  ["Mejorar", "Medir tendencia y reducción de desviaciones tras intervenir."],
];

function levelOf(negro: number) {
  return negro < 8 ? "A" : negro < 15 ? "B" : negro < 25 ? "C" : "D";
}
function riskOf(negro: number): [string, string] {
  return negro >= 15 ? ["Alto", "bg-rose-100 text-rose-700"] : negro >= 8 ? ["Medio", "bg-amber-100 text-amber-700"] : ["Bajo", "bg-green-100 text-green-700"];
}
function confOf(total: number) {
  return total > 3000 ? "Alta" : total > 800 ? "Media" : "Baja";
}

function Bar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, pct(value, max))}%` }} />
    </div>
  );
}

function ProfileCard({ e, isC }: { e: Entity; isC: boolean }) {
  const negro = pct(e.icu4, e.total);
  const level = levelOf(negro);
  const [risk, riskCls] = riskOf(negro);
  const conf = confOf(e.total);
  const top = e.symptoms[0];
  const cat = byTech[top.name];
  const hist = e.symptoms.slice(0, 6);
  const hmax = Math.max(1, ...hist.map((s) => s.c));

  const dims = useMemo(() => {
    const d: Record<string, number> = {};
    e.symptoms.forEach((s) => { const k = symDim(s.name); d[k] = (d[k] || 0) + s.c; });
    return Object.entries(d).sort((a, b) => b[1] - a[1]);
  }, [e]);
  const validPct = e.con_tratamiento ? pct(e.validos, e.con_tratamiento) : 0;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Cabecera del perfil */}
      <div className="flex flex-col gap-5 border-b border-gray-100 bg-gray-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">SuperProfile · {isC ? "Transportista" : "Conductor"}</p>
          <h3 className="mt-1 text-xl font-bold text-gray-950">{e.name}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isC
              ? `${fmt(e.conductores || 0)} conductores · ${fmt(e.assets)} activos · ${fmt(e.viajes)} viajes en el mes`
              : `${e.carrier || "—"} · ${fmt(e.assets)} activos · ${fmt(e.viajes)} viajes`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Nivel operacional", level], ["Confianza", conf], ["Riesgo actual", risk], ["Evaluación", "Jun 2026"]].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{k}</p>
              <p className="mt-0.5 text-base font-extrabold text-gray-950">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Módulos */}
      <div className="grid gap-5 p-6 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <h4 className="text-sm font-bold text-gray-950">Identidad</h4>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {isC ? "Empresa transportista." : "Persona operacional."}{" "}
            {isC ? `${fmt(e.conductores || 0)} conductores y ${fmt(e.assets)} activos asociados.` : `Pertenece a ${e.carrier || "—"}.`}{" "}
            Base de evidencia: <b>{fmt(e.total)}</b> síntomas en junio.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-950">Estado actual</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskCls}`}>Riesgo {risk}</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Nivel {level}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            <b>{fmt(e.total)}</b> síntomas · <b className="text-rose-600">{negro}%</b> código negro · <b>{validPct}%</b> de tratamientos válidos.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-950">Patrones</h4>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Su comportamiento se concentra en <b>{nice(top.name)}</b> ({pct(top.c, e.total)}% del total, {fmt(top.icu4)} en código negro).{" "}
            {isC ? "La reincidencia se agrega desde sus conductores y activos." : "Reincidencia individual comparada contra su transportista."}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-950">Historia · top síntomas</h4>
          <div className="mt-3 space-y-2">
            {hist.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-xs text-gray-600"><span>{nice(s.name)}</span><span className="tabular-nums text-gray-400">{fmt(s.c)}</span></div>
                <div className="mt-1"><Bar value={s.c} max={hmax} /></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-950">Comportamiento observado</h4>
          <div className="mt-3 space-y-2">
            {dims.map(([dim, val]) => (
              <div key={dim}>
                <div className="flex justify-between text-xs text-gray-600"><span>{dim}</span><span className="tabular-nums text-gray-400">{pct(val, e.total)}%</span></div>
                <div className="mt-1"><Bar value={val} max={e.total} color={DIM_COLOR[dim]} /></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-950">Plan de mejora</h4>
          <div className="mt-2 space-y-1 text-sm leading-relaxed text-gray-600">
            <p><b>Acción:</b> {cat?.action || "Corrección estructural"}.</p>
            <p><b>Dueño:</b> {cat?.owner || "Operaciones"}.</p>
            <p><b>Meta:</b> −30% de {nice(top.name)} en 60 días.</p>
            <p><b>Verificación:</b> recurrencia mensual.</p>
          </div>
        </div>
      </div>

      {/* Cierre */}
      <div className="border-t border-gray-100 bg-blue-50/50 px-6 py-4">
        <p className="text-sm leading-relaxed text-gray-700">
          El SuperProfile de <b>{e.name}</b> se arma solo desde los {fmt(e.total)} síntomas de junio: nivel <b>{level}</b>, riesgo <b>{risk}</b>, foco en <b>{nice(top.name)}</b>.
          La gestión no parte de un número abstracto — parte de la historia: se asigna el plan (<b>{cat?.action || "—"}</b>) al dueño (<b>{cat?.owner || "Operaciones"}</b>) y se mide si la recurrencia baja el próximo mes.
        </p>
      </div>
    </div>
  );
}

export default function SuperProfile() {
  const [type, setType] = useState<"carrier" | "driver">("carrier");
  const [idx, setIdx] = useState(0);
  const list = type === "carrier" ? ENTITY_DATA.carriers : ENTITY_DATA.drivers;
  const e = list[Math.min(idx, list.length - 1)];

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Acto 2 · Entender a cada actor</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl">
        SuperProfile — la identidad operacional viva de cada entidad
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-600">
        Un perfil construido por <b>evaluación continua del comportamiento observado</b>. No reemplaza licencias ni acreditaciones legales:
        consolida historia, estado actual, tendencia, evidencia y planes de mejora. <b>El score es solo un componente</b>; el producto es el perfil vivo.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {["Historia", "Estado actual", "Comportamiento", "Evidencia", "Mejora continua"].map((c) => (
          <span key={c} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">{c}</span>
        ))}
      </div>

      {/* Ciclo de valor */}
      <div className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">El ciclo de valor</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-950">Ver → Entender → Actuar → Resolver → Mejorar</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CYCLE.map(([t, d], i) => (
            <div key={t} className="rounded-xl border border-gray-200 bg-white p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{i + 1}</span>
              <h5 className="mt-3 font-bold text-gray-950">{t}</h5>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Arquitectura común */}
      <div className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Arquitectura común</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-950">Todo SuperProfile comparte la misma estructura</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ARCH.map(([t, d]) => (
            <div key={t} className="rounded-xl border border-gray-200 bg-white p-5">
              <h4 className="font-bold text-gray-950">{t}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Entidades */}
      <div className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">SuperProfiles por entidad</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-950">Mismo espíritu, distinto foco analítico</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ENTS.map(([t, sub, q]) => (
            <div key={t} className="rounded-xl border border-gray-200 bg-white p-5">
              <h4 className="font-bold text-gray-950">{t}</h4>
              <span className="mt-2 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{sub}</span>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{q}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Demo en vivo */}
      <div className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Demo en vivo · gestión consumiendo datos</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-950">Un SuperProfile poblado con la operación real de junio</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-gray-600">
          Así se ve consumir el dato: eliges una entidad y la plataforma arma su perfil vivo desde los síntomas reales — nivel, riesgo, historia, comportamiento y plan.
          <b> Sin score abstracto: gestión desde la historia.</b>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            {(["carrier", "driver"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); setIdx(0); }}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${type === t ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-950"}`}
              >
                {t === "carrier" ? "Transportistas" : "Conductores"}
              </button>
            ))}
          </div>
          <select
            value={Math.min(idx, list.length - 1)}
            onChange={(ev) => setIdx(+ev.target.value)}
            className="max-w-sm rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            {list.map((it, i) => (
              <option key={it.name} value={i}>{it.name} — {fmt(it.total)} síntomas</option>
            ))}
          </select>
        </div>

        {e && <ProfileCard e={e} isC={type === "carrier"} />}
      </div>

      {/* Principio de comunicación */}
      <div className="mt-10 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Principio de comunicación</p>
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-gray-700">
          SuperProfile no es licencia legal ni acreditación formal. Se comunica como <b>evaluación operacional interna</b>:
          «nivel operacional», «estado observado», «perfil vivo», «confiabilidad operacional» — bajo las reglas y estándares definidos por la organización.
        </p>
      </div>
    </section>
  );
}

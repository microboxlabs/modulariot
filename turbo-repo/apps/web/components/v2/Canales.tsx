"use client";

import { useState } from "react";
import { SYMPTOMS } from "./torre-data";
import { ENTITY_DATA, type Entity } from "./torre-modules-data";

// ============================================================
// Acto 3 · Canales de escalamiento — la misma inteligencia, en el canal
// donde vive la operación. Port nativo (DS) de /torre.html#comunicativos.
// Correo · WhatsApp · Teams · Webex · SMS, poblados desde el SuperProfile.
// ============================================================

const fmt = (n: number) => n.toLocaleString("es-CL");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const byTech = Object.fromEntries(SYMPTOMS.map((s) => [s.technicalName, s]));
const nice = (t: string) => byTech[t]?.name || t;

interface Payload {
  isC: boolean; tipo: string; name: string; nivel: string; riesgo: string;
  negro: number; total: number; foco: string; focoPct: number; plan: string; owner: string;
}

function payloadOf(e: Entity, isC: boolean): Payload {
  const negro = pct(e.icu4, e.total);
  const nivel = negro < 8 ? "A" : negro < 15 ? "B" : negro < 25 ? "C" : "D";
  const riesgo = negro >= 15 ? "Alto" : negro >= 8 ? "Medio" : "Bajo";
  const top = e.symptoms[0];
  const cat = byTech[top.name];
  return {
    isC, tipo: isC ? "Transportista" : "Conductor", name: e.name, nivel, riesgo, negro,
    total: e.total, foco: nice(top.name), focoPct: pct(top.c, e.total),
    plan: cat?.action || "Corrección estructural", owner: cat?.owner || "Operaciones",
  };
}

// Envoltorio de canal: etiqueta + mock + caption.
function Channel({ color, tag, caption, children }: { color: string; tag: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-bold text-gray-950">{tag}</span>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">{children}</div>
      <p className="mt-2 text-xs leading-relaxed text-gray-500"><b className="text-gray-700">Cuándo:</b> {caption}</p>
    </div>
  );
}

function EmailMock({ p }: { p: Payload }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 p-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">MB</span>
        <div className="leading-tight">
          <p className="font-semibold text-gray-950">ModularIoT · Torre de Control</p>
          <p className="text-[11px] text-gray-400">alertas@modulariot.com</p>
        </div>
      </div>
      <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-700">
        [SuperProfile] {p.tipo} · Nivel {p.nivel} · Riesgo {p.riesgo}
      </div>
      <div className="space-y-3 p-3 text-gray-600">
        <p>Resumen operacional de <b>{p.name}</b> — junio 2026:</p>
        <div className="grid grid-cols-3 gap-2">
          {[[fmt(p.total), "síntomas"], [`${p.negro}%`, "código negro"], [p.nivel, "nivel oper."]].map(([v, l]) => (
            <div key={l} className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-center">
              <p className="text-base font-extrabold text-gray-950">{v}</p><p className="text-[10px] text-gray-500">{l}</p>
            </div>
          ))}
        </div>
        <p>Foco del mes: <b>{p.foco}</b> ({p.focoPct}%). Plan asignado: {p.plan} — dueño {p.owner}.</p>
        <span className="inline-block font-semibold text-blue-700">Ver SuperProfile completo →</span>
      </div>
    </div>
  );
}

function WhatsAppMock({ p }: { p: Payload }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 bg-[#075e54] p-3 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">MB</span>
        <div className="leading-tight"><p className="font-semibold">ModularIoT Torre</p><p className="text-[11px] text-white/70">en línea</p></div>
      </div>
      <div className="space-y-2 bg-[#e5ddd5] p-3">
        <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white p-2.5 text-[13px] text-gray-800 shadow-sm">
          <b>Alerta {p.tipo}</b><br />{p.name}<br />Nivel <b>{p.nivel}</b> · Riesgo <b>{p.riesgo}</b><br />Foco: {p.foco} ({p.focoPct}%)<br />Plan: {p.plan}
          <span className="mt-1 block text-right text-[10px] text-gray-400">09:24 ✓✓</span>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-700 shadow-sm">Ver perfil</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-700 shadow-sm">Asignar plan</span>
        </div>
      </div>
    </div>
  );
}

function TeamsMock({ p }: { p: Payload }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 p-3 text-xs font-semibold text-gray-600">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-[#6264a7] text-[11px] font-bold text-white">T</span>
        ModularIoT · canal Torre Mintral
      </div>
      <div className="p-3">
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <div className="h-1 bg-[#6264a7]" />
          <div className="p-3">
            <p className="text-xs font-semibold text-gray-500">SuperProfile · {p.tipo}</p>
            <h5 className="mt-0.5 font-bold text-gray-950">{p.name}</h5>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-gray-400">Nivel</dt><dd className="font-semibold text-gray-800">{p.nivel}</dd>
              <dt className="text-gray-400">Riesgo</dt><dd className="font-semibold text-gray-800">{p.riesgo}</dd>
              <dt className="text-gray-400">Foco</dt><dd className="font-semibold text-gray-800">{p.foco} ({p.focoPct}%)</dd>
              <dt className="text-gray-400">Base</dt><dd className="font-semibold text-gray-800">{fmt(p.total)} síntomas</dd>
            </dl>
            <div className="mt-3 flex gap-2">
              <span className="rounded-md bg-[#6264a7] px-3 py-1 text-xs font-semibold text-white">Ver perfil</span>
              <span className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700">Asignar plan</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebexMock({ p }: { p: Payload }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 p-3 text-xs font-semibold text-gray-600">
        <span className="h-2.5 w-2.5 rounded-full bg-[#087f8c]" /> Webex · espacio «Torre ↔ Mintral»
      </div>
      <div className="flex gap-2 p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#087f8c] text-xs font-bold text-white">MB</span>
        <div className="flex-1">
          <p className="text-xs"><span className="font-semibold text-gray-950">ModularIoT</span> <span className="text-gray-400">09:24</span></p>
          <p className="mt-1 font-semibold text-gray-950">Alerta SuperProfile — {p.name}</p>
          <div className="mt-1.5 rounded-lg bg-gray-50 p-2.5 text-[13px] text-gray-700">
            Nivel <b>{p.nivel}</b> · Riesgo <b>{p.riesgo}</b> · Foco <b>{p.foco}</b> ({p.focoPct}%). Plan: {p.plan}.
          </div>
          <span className="mt-2 inline-block rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700">Abrir SuperProfile</span>
        </div>
      </div>
    </div>
  );
}

function SmsMock({ p }: { p: Payload }) {
  const nm = p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name;
  return (
    <div className="text-sm">
      <div className="border-b border-gray-100 p-3 text-center text-xs font-semibold text-gray-600">Mensajes · ModularIoT</div>
      <div className="p-3">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 p-2.5 text-[13px] text-gray-800">
          ModularIoT: {nm} Nivel {p.nivel}. {p.foco} {p.focoPct}%. Cód.negro {p.negro}%. Ver mdl.io/sp
        </div>
        <p className="mt-1 text-[10px] text-gray-400">Entregado · 09:24</p>
      </div>
    </div>
  );
}

export default function Canales() {
  const [type, setType] = useState<"carrier" | "driver">("carrier");
  const [idx, setIdx] = useState(0);
  const list = type === "carrier" ? ENTITY_DATA.carriers : ENTITY_DATA.drivers;
  const e = list[Math.min(idx, list.length - 1)];
  const p = payloadOf(e, type === "carrier");

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Acto 3 · Canales de escalamiento</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl">
        La misma inteligencia, en el canal donde vive la operación
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-600">
        El SuperProfile no se queda en una pantalla. La misma alerta — <b>nivel, riesgo, foco y plan</b> — se entrega donde cada actor ya trabaja:
        correo, WhatsApp, Teams, Webex y SMS. Elige una entidad y mira cómo se ve en cada canal.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
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
          {list.map((it, i) => (<option key={it.name} value={i}>{it.name}</option>))}
        </select>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Channel color="#2563eb" tag="Correo electrónico" caption="resumen y gestión para la Torre y jefaturas."><EmailMock p={p} /></Channel>
        <Channel color="#25d366" tag="WhatsApp" caption="alerta directa al conductor o transportista en terreno."><WhatsAppMock p={p} /></Channel>
        <Channel color="#6264a7" tag="Microsoft Teams" caption="flujo interno de la Torre (Entra ID), con acciones inline."><TeamsMock p={p} /></Channel>
        <Channel color="#087f8c" tag="Cisco Webex" caption="colaboración con el mandante o cliente en su espacio."><WebexMock p={p} /></Channel>
        <Channel color="#34c759" tag="SMS" caption="respaldo sin datos ni app — llega incluso en zonas ciegas."><SmsMock p={p} /></Channel>
      </div>

      <div className="mt-8 rounded-xl border-l-4 border-blue-600 bg-blue-50/60 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">El punto</p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
          Un solo motor de reglas, cinco canales. La notificación no es genérica: nace del SuperProfile y lleva el <b>plan y el dueño</b>,
          para que comunicar sea el primer paso de la gestión — no solo un aviso.
        </p>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { getTorre, getModules } from "./module-i18n";
import { type Entity } from "./torre-modules-data";
import { useLang } from "./useLang";

// ============================================================
// Acto 3 · Canales de escalamiento — la misma inteligencia, en el canal
// donde vive la operación. Port nativo (DS) de /torre.html#comunicativos.
// Correo · WhatsApp · Teams · Webex · SMS, poblados desde el SuperProfile.
// ============================================================

const fmt = (n: number) => n.toLocaleString("es-CL");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

// Diccionario trilingüe de strings de UI (es/en/pt). Los valores de datos
// (nombres de síntomas, planes, dueños, entidades) los provee el resolver por idioma.
const UI = {
  es: {
    transportista: "Transportista",
    conductor: "Conductor",
    riesgoAlto: "Alto",
    riesgoMedio: "Medio",
    riesgoBajo: "Bajo",
    planFallback: "Corrección estructural",
    ownerFallback: "Operaciones",
    cuando: "Cuándo:",
    nivel: "Nivel",
    riesgo: "Riesgo",
    foco: "Foco",
    focoLabel: "Foco:",
    planLabel: "Plan:",
    base: "Base",
    sintomas: "síntomas",
    verPerfil: "Ver perfil",
    asignarPlan: "Asignar plan",
    alerta: "Alerta",
    emailSender: "ModularIoT · Torre de Control",
    codigoNegro: "código negro",
    nivelOper: "nivel oper.",
    emailResumenPre: "Resumen operacional de",
    emailResumenPost: "— junio 2026:",
    focoMesLabel: "Foco del mes:",
    planAsignadoLabel: "Plan asignado:",
    duenoLabel: "dueño",
    verSuperProfileCompleto: "Ver SuperProfile completo →",
    waTitle: "ModularIoT Torre",
    enLinea: "en línea",
    teamsChannel: "ModularIoT · canal Torre Mintral",
    webexSpace: "Webex · espacio «Torre ↔ Mintral»",
    webexAlerta: "Alerta SuperProfile —",
    abrirSuperProfile: "Abrir SuperProfile",
    mensajes: "Mensajes · ModularIoT",
    codNegroShort: "Cód.negro",
    verLink: "Ver mdl.io/sp",
    entregado: "Entregado",
    eyebrow: "Acto 3 · Canales de escalamiento",
    heading: "La misma inteligencia, en el canal donde vive la operación",
    introPre: "El SuperProfile no se queda en una pantalla. La misma alerta —",
    introBold: "nivel, riesgo, foco y plan",
    introPost:
      "— se entrega donde cada actor ya trabaja: correo, WhatsApp, Teams, Webex y SMS. Elige una entidad y mira cómo se ve en cada canal.",
    transportistas: "Transportistas",
    conductores: "Conductores",
    tagCorreo: "Correo electrónico",
    capCorreo: "resumen y gestión para la Torre y jefaturas.",
    capWhatsApp: "alerta directa al conductor o transportista en terreno.",
    capTeams: "flujo interno de la Torre (Entra ID), con acciones inline.",
    capWebex: "colaboración con el mandante o cliente en su espacio.",
    capSms: "respaldo sin datos ni app — llega incluso en zonas ciegas.",
    elPunto: "El punto",
    puntoPre:
      "Un solo motor de reglas, cinco canales. La notificación no es genérica: nace del SuperProfile y lleva el",
    puntoBold: "plan y el dueño",
    puntoPost:
      ", para que comunicar sea el primer paso de la gestión — no solo un aviso.",
  },
  en: {
    transportista: "Carrier",
    conductor: "Driver",
    riesgoAlto: "High",
    riesgoMedio: "Medium",
    riesgoBajo: "Low",
    planFallback: "Structural correction",
    ownerFallback: "Operations",
    cuando: "When:",
    nivel: "Level",
    riesgo: "Risk",
    foco: "Focus",
    focoLabel: "Focus:",
    planLabel: "Plan:",
    base: "Base",
    sintomas: "symptoms",
    verPerfil: "View profile",
    asignarPlan: "Assign plan",
    alerta: "Alert",
    emailSender: "ModularIoT · Control Tower",
    codigoNegro: "black code",
    nivelOper: "oper. level",
    emailResumenPre: "Operational summary of",
    emailResumenPost: "— June 2026:",
    focoMesLabel: "Focus of the month:",
    planAsignadoLabel: "Assigned plan:",
    duenoLabel: "owner",
    verSuperProfileCompleto: "View full SuperProfile →",
    waTitle: "ModularIoT Tower",
    enLinea: "online",
    teamsChannel: "ModularIoT · Torre Mintral channel",
    webexSpace: "Webex · «Torre ↔ Mintral» space",
    webexAlerta: "SuperProfile alert —",
    abrirSuperProfile: "Open SuperProfile",
    mensajes: "Messages · ModularIoT",
    codNegroShort: "Black code",
    verLink: "View mdl.io/sp",
    entregado: "Delivered",
    eyebrow: "Act 3 · Escalation channels",
    heading: "The same intelligence, in the channel where operations live",
    introPre: "The SuperProfile doesn't stay on a screen. The same alert —",
    introBold: "level, risk, focus and plan",
    introPost:
      "— is delivered where each actor already works: email, WhatsApp, Teams, Webex and SMS. Pick an entity and see how it looks in each channel.",
    transportistas: "Carriers",
    conductores: "Drivers",
    tagCorreo: "Email",
    capCorreo: "summary and management for the Tower and leadership.",
    capWhatsApp: "direct alert to the driver or carrier in the field.",
    capTeams: "internal Tower flow (Entra ID), with inline actions.",
    capWebex: "collaboration with the principal or client in their space.",
    capSms: "backup with no data or app — arrives even in blind spots.",
    elPunto: "The point",
    puntoPre:
      "A single rules engine, five channels. The notification isn't generic: it's born from the SuperProfile and carries the",
    puntoBold: "plan and the owner",
    puntoPost:
      ", so that communicating becomes the first step of management — not just a notice.",
  },
  pt: {
    transportista: "Transportadora",
    conductor: "Motorista",
    riesgoAlto: "Alto",
    riesgoMedio: "Médio",
    riesgoBajo: "Baixo",
    planFallback: "Correção estrutural",
    ownerFallback: "Operações",
    cuando: "Quando:",
    nivel: "Nível",
    riesgo: "Risco",
    foco: "Foco",
    focoLabel: "Foco:",
    planLabel: "Plano:",
    base: "Base",
    sintomas: "sintomas",
    verPerfil: "Ver perfil",
    asignarPlan: "Atribuir plano",
    alerta: "Alerta",
    emailSender: "ModularIoT · Torre de Controle",
    codigoNegro: "código preto",
    nivelOper: "nível oper.",
    emailResumenPre: "Resumo operacional de",
    emailResumenPost: "— junho 2026:",
    focoMesLabel: "Foco do mês:",
    planAsignadoLabel: "Plano atribuído:",
    duenoLabel: "responsável",
    verSuperProfileCompleto: "Ver SuperProfile completo →",
    waTitle: "ModularIoT Torre",
    enLinea: "online",
    teamsChannel: "ModularIoT · canal Torre Mintral",
    webexSpace: "Webex · espaço «Torre ↔ Mintral»",
    webexAlerta: "Alerta SuperProfile —",
    abrirSuperProfile: "Abrir SuperProfile",
    mensajes: "Mensagens · ModularIoT",
    codNegroShort: "Cód.preto",
    verLink: "Ver mdl.io/sp",
    entregado: "Entregue",
    eyebrow: "Ato 3 · Canais de escalonamento",
    heading: "A mesma inteligência, no canal onde a operação vive",
    introPre: "O SuperProfile não fica em uma tela. O mesmo alerta —",
    introBold: "nível, risco, foco e plano",
    introPost:
      "— é entregue onde cada ator já trabalha: e-mail, WhatsApp, Teams, Webex e SMS. Escolha uma entidade e veja como fica em cada canal.",
    transportistas: "Transportadoras",
    conductores: "Motoristas",
    tagCorreo: "E-mail",
    capCorreo: "resumo e gestão para a Torre e as chefias.",
    capWhatsApp: "alerta direto ao motorista ou transportadora em campo.",
    capTeams: "fluxo interno da Torre (Entra ID), com ações inline.",
    capWebex: "colaboração com o mandante ou cliente no seu espaço.",
    capSms: "respaldo sem dados nem app — chega até em zonas cegas.",
    elPunto: "O ponto",
    puntoPre:
      "Um único motor de regras, cinco canais. A notificação não é genérica: nasce do SuperProfile e leva o",
    puntoBold: "plano e o responsável",
    puntoPost:
      ", para que comunicar seja o primeiro passo da gestão — não apenas um aviso.",
  },
};

type Dict = typeof UI.es;

interface Payload {
  isC: boolean; tipo: string; name: string; nivel: string; riesgo: string;
  negro: number; total: number; foco: string; focoPct: number; plan: string; owner: string;
}

// Envoltorio de canal: etiqueta + mock + caption.
function Channel({ color, tag, caption, t, children }: { color: string; tag: string; caption: string; t: Dict; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold text-ink-1">{tag}</span>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-hairline bg-surface">{children}</div>
      <p className="mt-2 text-xs leading-relaxed text-ink-3"><b className="text-ink-2">{t.cuando}</b> {caption}</p>
    </div>
  );
}

function EmailMock({ p, t }: { p: Payload; t: Dict }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 border-b border-hairline p-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-xs font-semibold text-white">MB</span>
        <div className="leading-tight">
          <p className="font-semibold text-ink-1">{t.emailSender}</p>
          <p className="text-[11px] text-ink-3">alertas@modulariot.com</p>
        </div>
      </div>
      <div className="border-b border-hairline px-3 py-2 text-xs font-semibold text-ink-2">
        [SuperProfile] {p.tipo} · {t.nivel} {p.nivel} · {t.riesgo} {p.riesgo}
      </div>
      <div className="space-y-3 p-3 text-ink-2">
        <p>{t.emailResumenPre} <b>{p.name}</b> {t.emailResumenPost}</p>
        <div className="grid grid-cols-3 gap-2">
          {[[fmt(p.total), t.sintomas], [`${p.negro}%`, t.codigoNegro], [p.nivel, t.nivelOper]].map(([v, l]) => (
            <div key={l} className="rounded-lg border border-hairline bg-surface-2 p-2 text-center">
              <p className="text-base font-semibold tracking-[-0.02em] text-ink-1">{v}</p><p className="text-[10px] text-ink-3">{l}</p>
            </div>
          ))}
        </div>
        <p>{t.focoMesLabel} <b>{p.foco}</b> ({p.focoPct}%). {t.planAsignadoLabel} {p.plan} — {t.duenoLabel} {p.owner}.</p>
        <span className="inline-block font-semibold text-accent">{t.verSuperProfileCompleto}</span>
      </div>
    </div>
  );
}

function WhatsAppMock({ p, t }: { p: Payload; t: Dict }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 bg-[#075e54] p-3 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">MB</span>
        <div className="leading-tight"><p className="font-semibold">{t.waTitle}</p><p className="text-[11px] text-white/70">{t.enLinea}</p></div>
      </div>
      <div className="space-y-2 bg-[#e5ddd5] p-3">
        <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white p-2.5 text-[13px] text-gray-800 shadow-sm">
          <b>{t.alerta} {p.tipo}</b><br />{p.name}<br />{t.nivel} <b>{p.nivel}</b> · {t.riesgo} <b>{p.riesgo}</b><br />{t.focoLabel} {p.foco} ({p.focoPct}%)<br />{t.planLabel} {p.plan}
          <span className="mt-1 block text-right text-[10px] text-gray-400">09:24 ✓✓</span>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-700 shadow-sm">{t.verPerfil}</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-700 shadow-sm">{t.asignarPlan}</span>
        </div>
      </div>
    </div>
  );
}

function TeamsMock({ p, t }: { p: Payload; t: Dict }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 border-b border-hairline p-3 text-xs font-semibold text-ink-2">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-[#6264a7] text-[11px] font-semibold text-white">T</span>
        {t.teamsChannel}
      </div>
      <div className="p-3">
        <div className="overflow-hidden rounded-lg border border-hairline">
          <div className="h-1 bg-[#6264a7]" />
          <div className="p-3">
            <p className="text-xs font-semibold text-ink-3">SuperProfile · {p.tipo}</p>
            <h5 className="mt-0.5 font-semibold text-ink-1">{p.name}</h5>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-ink-3">{t.nivel}</dt><dd className="font-semibold text-ink-2">{p.nivel}</dd>
              <dt className="text-ink-3">{t.riesgo}</dt><dd className="font-semibold text-ink-2">{p.riesgo}</dd>
              <dt className="text-ink-3">{t.foco}</dt><dd className="font-semibold text-ink-2">{p.foco} ({p.focoPct}%)</dd>
              <dt className="text-ink-3">{t.base}</dt><dd className="font-semibold text-ink-2">{fmt(p.total)} {t.sintomas}</dd>
            </dl>
            <div className="mt-3 flex gap-2">
              <span className="rounded-md bg-[#6264a7] px-3 py-1 text-xs font-semibold text-white">{t.verPerfil}</span>
              <span className="rounded-md border border-hairline-strong px-3 py-1 text-xs font-semibold text-ink-2">{t.asignarPlan}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebexMock({ p, t }: { p: Payload; t: Dict }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 border-b border-hairline p-3 text-xs font-semibold text-ink-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#087f8c]" /> {t.webexSpace}
      </div>
      <div className="flex gap-2 p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#087f8c] text-xs font-semibold text-white">MB</span>
        <div className="flex-1">
          <p className="text-xs"><span className="font-semibold text-ink-1">ModularIoT</span> <span className="text-ink-3">09:24</span></p>
          <p className="mt-1 font-semibold text-ink-1">{t.webexAlerta} {p.name}</p>
          <div className="mt-1.5 rounded-lg bg-surface-2 p-2.5 text-[13px] text-ink-2">
            {t.nivel} <b>{p.nivel}</b> · {t.riesgo} <b>{p.riesgo}</b> · {t.foco} <b>{p.foco}</b> ({p.focoPct}%). {t.planLabel} {p.plan}.
          </div>
          <span className="mt-2 inline-block rounded-md border border-hairline-strong px-3 py-1 text-xs font-semibold text-ink-2">{t.abrirSuperProfile}</span>
        </div>
      </div>
    </div>
  );
}

function SmsMock({ p, t }: { p: Payload; t: Dict }) {
  const nm = p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name;
  return (
    <div className="text-sm">
      <div className="border-b border-hairline p-3 text-center text-xs font-semibold text-ink-2">{t.mensajes}</div>
      <div className="p-3">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-3 p-2.5 text-[13px] text-ink-2">
          ModularIoT: {nm} {t.nivel} {p.nivel}. {p.foco} {p.focoPct}%. {t.codNegroShort} {p.negro}%. {t.verLink}
        </div>
        <p className="mt-1 text-[10px] text-ink-3">{t.entregado} · 09:24</p>
      </div>
    </div>
  );
}

export default function Canales() {
  const lang = useLang();
  const { SYMPTOMS } = getTorre(lang);
  const { ENTITY_DATA } = getModules(lang);
  const t = UI[(lang as "es" | "en" | "pt")] ?? UI.es;

  const byTech = Object.fromEntries(SYMPTOMS.map((s) => [s.technicalName, s]));
  const nice = (tn: string) => byTech[tn]?.name || tn;

  const payloadOf = (e: Entity, isC: boolean): Payload => {
    const negro = pct(e.icu4, e.total);
    const nivel = negro < 8 ? "A" : negro < 15 ? "B" : negro < 25 ? "C" : "D";
    const riesgo = negro >= 15 ? t.riesgoAlto : negro >= 8 ? t.riesgoMedio : t.riesgoBajo;
    const top = e.symptoms[0];
    const cat = byTech[top.name];
    return {
      isC, tipo: isC ? t.transportista : t.conductor, name: e.name, nivel, riesgo, negro,
      total: e.total, foco: nice(top.name), focoPct: pct(top.c, e.total),
      plan: cat?.action || t.planFallback, owner: cat?.owner || t.ownerFallback,
    };
  };

  const [type, setType] = useState<"carrier" | "driver">("carrier");
  const [idx, setIdx] = useState(0);
  const list = type === "carrier" ? ENTITY_DATA.carriers : ENTITY_DATA.drivers;
  const e = list[Math.min(idx, list.length - 1)];
  const p = payloadOf(e, type === "carrier");

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t.eyebrow}</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-5xl">
        {t.heading}
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2">
        {t.introPre} <b>{t.introBold}</b> {t.introPost}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-hairline bg-surface p-1">
          {(["carrier", "driver"] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => { setType(tp); setIdx(0); }}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${type === tp ? "bg-accent text-white" : "text-ink-2 hover:text-ink-1"}`}
            >
              {tp === "carrier" ? t.transportistas : t.conductores}
            </button>
          ))}
        </div>
        <select
          value={Math.min(idx, list.length - 1)}
          onChange={(ev) => setIdx(+ev.target.value)}
          className="max-w-sm rounded-lg border border-hairline-strong bg-surface px-3.5 py-2 text-sm text-ink-1 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {list.map((it, i) => (<option key={it.name} value={i}>{it.name}</option>))}
        </select>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Channel color="#2563eb" tag={t.tagCorreo} caption={t.capCorreo} t={t}><EmailMock p={p} t={t} /></Channel>
        <Channel color="#25d366" tag="WhatsApp" caption={t.capWhatsApp} t={t}><WhatsAppMock p={p} t={t} /></Channel>
        <Channel color="#6264a7" tag="Microsoft Teams" caption={t.capTeams} t={t}><TeamsMock p={p} t={t} /></Channel>
        <Channel color="#087f8c" tag="Cisco Webex" caption={t.capWebex} t={t}><WebexMock p={p} t={t} /></Channel>
        <Channel color="#34c759" tag="SMS" caption={t.capSms} t={t}><SmsMock p={p} t={t} /></Channel>
      </div>

      <div className="mt-8 rounded-xl border-l-4 border-accent bg-accent-soft/60 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t.elPunto}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
          {t.puntoPre} <b>{t.puntoBold}</b>{t.puntoPost}
        </p>
      </div>
    </section>
  );
}

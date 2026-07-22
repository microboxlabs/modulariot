"use client";

import { useMemo, useState } from "react";

// ============================================================
// Formulario de contacto segmentado por intención.
// 3 vistas: Agendar demo · Cotizar / propuesta · Contacto general.
// La intención se prellena según ?intent= del CTA de origen.
// Envío: mailto estructurado a contacto@microboxlabs.com (sin backend).
// Panel lateral mezcla la info de los módulos (síntomas, notificaciones,
// SuperProfile, GPS) para que la experiencia sea completa.
// ============================================================

type Intent = "demo" | "cotizar" | "general";
type Lang = "es" | "en" | "pt";

const EMAIL = "contacto@microboxlabs.com";

const COPY: Record<Lang, {
  eyebrow: string; title: string; subtitle: string;
  tabs: Record<Intent, string>;
  f: Record<string, string>;
  flota: string[]; interes: string[]; motivo: string[];
  submit: string; required: string; sending: string;
  ctxTitle: string; ctx: { t: string; d: string; href: string }[];
  note: string;
}> = {
  es: {
    eyebrow: "Contacto",
    title: "Hablemos de tu operación",
    subtitle: "Cuéntanos qué necesitas y te respondemos en menos de 24 horas. Elige el tipo de conversación para que lleguemos preparados.",
    tabs: { demo: "Agendar demo", cotizar: "Cotizar / propuesta", general: "Contacto general" },
    f: {
      nombre: "Nombre", email: "Email corporativo", empresa: "Empresa", cargo: "Cargo (opcional)",
      flota: "Tamaño de flota", interes: "¿Qué te interesa?", mensaje: "Mensaje", motivo: "Motivo",
      mensajePh: "Cuéntanos brevemente tu contexto operacional…",
    },
    flota: ["1–50 vehículos", "51–200 vehículos", "201–1.000 vehículos", "1.000+ vehículos"],
    interes: ["Síntomas / Torre de Control", "Ingesta GPS Core", "Integraciones y notificaciones", "Video en vivo", "SuperProfile"],
    motivo: ["Consulta general", "Soporte técnico", "Alianza / partnership", "Prensa"],
    submit: "Enviar mensaje", required: "Completa nombre y email para continuar.", sending: "Abriendo tu correo…",
    ctxTitle: "Lo que verás con ModularIoT",
    ctx: [
      { t: "Síntomas en la Torre de Control", d: "36 reglas de detección sobre una operación real.", href: "/torre" },
      { t: "Notificaciones en tu canal", d: "La alerta en correo, WhatsApp, Teams, Webex o SMS.", href: "/canales" },
      { t: "SuperProfile", d: "La identidad operacional viva de cada actor.", href: "/superprofile" },
      { t: "Precisión de señal GPS", d: "12/20 pulsos por minuto contra el estándar.", href: "/proveedores-gps" },
    ],
    note: "Sin compromiso · Tus datos no se comparten con terceros.",
  },
  en: {
    eyebrow: "Contact",
    title: "Let's talk about your operation",
    subtitle: "Tell us what you need and we'll reply within 24 hours. Pick the type of conversation so we come prepared.",
    tabs: { demo: "Book a demo", cotizar: "Get a quote", general: "General contact" },
    f: {
      nombre: "Name", email: "Work email", empresa: "Company", cargo: "Role (optional)",
      flota: "Fleet size", interes: "What are you interested in?", mensaje: "Message", motivo: "Reason",
      mensajePh: "Briefly tell us about your operational context…",
    },
    flota: ["1–50 vehicles", "51–200 vehicles", "201–1,000 vehicles", "1,000+ vehicles"],
    interes: ["Symptoms / Control Tower", "GPS Core ingestion", "Integrations & notifications", "Live video", "SuperProfile"],
    motivo: ["General inquiry", "Technical support", "Partnership", "Press"],
    submit: "Send message", required: "Enter name and email to continue.", sending: "Opening your email…",
    ctxTitle: "What you'll see with ModularIoT",
    ctx: [
      { t: "Symptoms in the Control Tower", d: "35 detection rules on a real operation.", href: "/torre" },
      { t: "Notifications in your channel", d: "The alert in email, WhatsApp, Teams, Webex or SMS.", href: "/canales" },
      { t: "SuperProfile", d: "The living operational identity of each actor.", href: "/superprofile" },
      { t: "GPS signal precision", d: "12/20 pulses per minute against the standard.", href: "/proveedores-gps" },
    ],
    note: "No commitment · Your data is not shared with third parties.",
  },
  pt: {
    eyebrow: "Contato",
    title: "Vamos falar da sua operação",
    subtitle: "Conte o que precisa e respondemos em menos de 24 horas. Escolha o tipo de conversa para chegarmos preparados.",
    tabs: { demo: "Agendar demo", cotizar: "Cotar / proposta", general: "Contato geral" },
    f: {
      nombre: "Nome", email: "E-mail corporativo", empresa: "Empresa", cargo: "Cargo (opcional)",
      flota: "Tamanho da frota", interes: "O que te interessa?", mensaje: "Mensagem", motivo: "Motivo",
      mensajePh: "Conte brevemente seu contexto operacional…",
    },
    flota: ["1–50 veículos", "51–200 veículos", "201–1.000 veículos", "1.000+ veículos"],
    interes: ["Sintomas / Torre de Controle", "Ingestão GPS Core", "Integrações e notificações", "Vídeo ao vivo", "SuperProfile"],
    motivo: ["Consulta geral", "Suporte técnico", "Parceria", "Imprensa"],
    submit: "Enviar mensagem", required: "Preencha nome e e-mail para continuar.", sending: "Abrindo seu e-mail…",
    ctxTitle: "O que você verá com o ModularIoT",
    ctx: [
      { t: "Sintomas na Torre de Controle", d: "35 regras de detecção sobre uma operação real.", href: "/torre" },
      { t: "Notificações no seu canal", d: "O alerta em e-mail, WhatsApp, Teams, Webex ou SMS.", href: "/canales" },
      { t: "SuperProfile", d: "A identidade operacional viva de cada ator.", href: "/superprofile" },
      { t: "Precisão de sinal GPS", d: "12/20 pulsos por minuto contra o padrão.", href: "/proveedores-gps" },
    ],
    note: "Sem compromisso · Seus dados não são compartilhados com terceiros.",
  },
};

const SUBJECT: Record<Intent, string> = { demo: "[Demo]", cotizar: "[Cotización]", general: "[Contacto]" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-hairline-strong bg-surface px-3.5 py-2.5 text-sm text-ink-1 placeholder:text-ink-4 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export default function ContactForm({ lang = "es", initialIntent = "demo", base }: { lang?: Lang; initialIntent?: Intent; base: string }) {
  const t = COPY[lang] || COPY.es;
  const [intent, setIntent] = useState<Intent>(initialIntent);
  const [f, setF] = useState<Record<string, string>>({ nombre: "", email: "", empresa: "", cargo: "", flota: "", mensaje: "", motivo: "" });
  const [interes, setInteres] = useState<string[]>([]);
  const [err, setErr] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const toggleInteres = (v: string) =>
    setInteres((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const valid = f.nombre.trim() && /.+@.+\..+/.test(f.email);

  const mailto = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Tipo: ${t.tabs[intent]}`);
    lines.push(`Nombre: ${f.nombre}`);
    lines.push(`Email: ${f.email}`);
    if (f.empresa) lines.push(`Empresa: ${f.empresa}`);
    if (f.cargo) lines.push(`Cargo: ${f.cargo}`);
    if (intent !== "general" && f.flota) lines.push(`Flota: ${f.flota}`);
    if (intent === "cotizar" && interes.length) lines.push(`Interés: ${interes.join(", ")}`);
    if (intent === "general" && f.motivo) lines.push(`Motivo: ${f.motivo}`);
    if (f.mensaje) lines.push("", f.mensaje);
    const subject = `${SUBJECT[intent]} ${f.empresa || f.nombre || "ModularIoT"}`;
    return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }, [intent, f, interes, t]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { setErr(true); return; }
    setErr(false);
    window.location.href = mailto;
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t.eyebrow}</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-5xl">{t.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-2">{t.subtitle}</p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        {/* Formulario */}
        <div className="lg:col-span-2">
          {/* Segmentos de intención */}
          <div className="inline-flex flex-wrap gap-1 rounded-lg border border-hairline bg-surface p-1">
            {(["demo", "cotizar", "general"] as Intent[]).map((it) => (
              <button
                key={it}
                type="button"
                onClick={() => setIntent(it)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${intent === it ? "bg-accent text-white" : "text-ink-2 hover:text-ink-1"}`}
              >
                {t.tabs[it]}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.f.nombre}><input className={inputCls} value={f.nombre} onChange={set("nombre")} required /></Field>
              <Field label={t.f.email}><input type="email" className={inputCls} value={f.email} onChange={set("email")} required /></Field>
              <Field label={t.f.empresa}><input className={inputCls} value={f.empresa} onChange={set("empresa")} /></Field>
              <Field label={t.f.cargo}><input className={inputCls} value={f.cargo} onChange={set("cargo")} /></Field>
            </div>

            {intent !== "general" && (
              <Field label={t.f.flota}>
                <select className={inputCls} value={f.flota} onChange={set("flota")}>
                  <option value="">—</option>
                  {t.flota.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            )}

            {intent === "cotizar" && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink-2">{t.f.interes}</legend>
                <div className="flex flex-wrap gap-2">
                  {t.interes.map((o) => {
                    const on = interes.includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => toggleInteres(o)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent" : "border-hairline-strong bg-surface text-ink-2 hover:border-ink-4"}`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {intent === "general" && (
              <Field label={t.f.motivo}>
                <select className={inputCls} value={f.motivo} onChange={set("motivo")}>
                  <option value="">—</option>
                  {t.motivo.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            )}

            <Field label={t.f.mensaje}>
              <textarea className={`${inputCls} min-h-28 resize-y`} value={f.mensaje} onChange={set("mensaje")} placeholder={t.f.mensajePh} />
            </Field>

            {err && <p className="text-sm font-medium text-rose-600">{t.required}</p>}

            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" className="rounded-lg border border-ink-1 bg-ink-1 px-6 py-3 text-sm font-medium text-page transition-colors hover:bg-ink-2 hover:border-ink-2">
                {t.submit}
              </button>
              <p className="text-sm text-ink-3">{t.note}</p>
            </div>
          </form>
        </div>

        {/* Contexto: los módulos */}
        <aside className="lg:col-span-1">
          <div className="rounded-xl border border-hairline bg-surface-2/60 p-6">
            <p className="text-sm font-semibold text-ink-1">{t.ctxTitle}</p>
            <ul className="mt-4 space-y-4">
              {t.ctx.map((c) => (
                <li key={c.t}>
                  <a href={`${base}${c.href}`} className="group block">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-1 group-hover:text-accent">
                      {c.t}
                      <svg className="h-3.5 w-3.5 text-accent opacity-0 transition-opacity group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 12h15m0 0l-6-6m6 6l-6 6" />
                      </svg>
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-ink-3">{c.d}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

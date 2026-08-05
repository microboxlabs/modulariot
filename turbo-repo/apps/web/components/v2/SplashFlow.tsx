"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LynxMark, LynxWordmark } from "@modulariot/ui/brand/logo";
import { SelectDropdown } from "./SelectDropdown";

// Splash del "coming soon": la vista hero se reemplaza por el formulario de
// demo (no se expande debajo del botón) — mismo patrón de tarjeta animada
// que StepsInteractive, con botón "Volver" arriba a la izquierda.

const EMAIL = "contacto@microboxlabs.com";
// Bucket propio para flotas muy chicas (1–5): antes quedaban mezcladas en "1–50".
const FLOTA = ["1–5 vehículos", "6–50 vehículos", "51–200 vehículos", "201–1.000 vehículos", "1.000+ vehículos"];

const inputCls =
  "w-full rounded-lg border border-hairline-strong bg-surface px-3.5 py-2.5 text-sm text-ink-1 placeholder:text-ink-4 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  );
}

// Misma dirección que cardVariants en StepsInteractive: avanzar entra por la
// derecha y sale por la izquierda; volver, al revés.
const variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction >= 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction >= 0 ? -24 : 24 }),
};

type FormState = { nombre: string; email: string; empresa: string; cargo: string; flota: string; mensaje: string };

function HeroView({ onDemo }: { onDemo: () => void }) {
  return (
    <>
      
      <div className="flex flex-col items-center text-brand-ink">
        <LynxMark className="h-16 w-16" />
        <LynxWordmark className="h-6 w-auto" />
      </div>
      <span className="mt-4 mb-6 inline-block rounded-full border border-hairline bg-surface px-4 py-1.5 font-mono text-xs font-medium text-ink-2">
        Código Abierto · Apache-2.0
      </span>
      <h1 className="display mt-2 text-5xl sm:text-5xl">
        De detectar a{" "}
        <span className="amber-chevron">
          reducir
          <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 2 L50 8 L100 2 L100 6 L50 12 L0 6 Z" fill="currentColor" />
          </svg>
        </span>
      </h1>

      <p className="mx-auto mt-6 text-lg leading-relaxed text-ink-2">
        Convertimos tus alertas en mejoras reales para tu operación.
      </p>

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onDemo}
          className="w-full rounded-lg border border-hairline-strong bg-surface px-6 py-3 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-3 sm:w-auto"
        >
          Agenda un demo
        </button>
      </div>
    </>
  );
}

function DemoView({ onBack }: { onBack: () => void }) {
  const [f, setF] = useState<FormState>({ nombre: "", email: "", empresa: "", cargo: "", flota: "", mensaje: "" });
  const [err, setErr] = useState(false);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const valid = f.nombre.trim() && /.+@.+\..+/.test(f.email);

  const mailto = useMemo(() => {
    const lines: string[] = ["Tipo: Agendar demo", `Nombre: ${f.nombre}`, `Email: ${f.email}`];
    if (f.empresa) lines.push(`Empresa: ${f.empresa}`);
    if (f.cargo) lines.push(`Cargo: ${f.cargo}`);
    if (f.flota) lines.push(`Flota: ${f.flota}`);
    if (f.mensaje) lines.push("", f.mensaje);
    const subject = `[Demo] ${f.empresa || f.nombre || "ModularIoT"}`;
    return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }, [f]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setErr(true);
      return;
    }
    setErr(false);
    window.location.href = mailto;
  };

  return (
    <div className="relative text-left">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-ink-3 transition-colors hover:text-ink-1"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Volver
      </button>

      <p className="text-sm font-semibold uppercase tracking-widest text-accent">Agenda un demo</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-ink-1">Cuéntanos de tu operación</h2>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input className={inputCls} value={f.nombre} onChange={set("nombre")} required />
          </Field>
          <Field label="Email corporativo">
            <input type="email" className={inputCls} value={f.email} onChange={set("email")} required />
          </Field>
          <Field label="Empresa">
            <input className={inputCls} value={f.empresa} onChange={set("empresa")} />
          </Field>
          <Field label="Cargo (opcional)">
            <input className={inputCls} value={f.cargo} onChange={set("cargo")} />
          </Field>
        </div>
        <Field label="Tamaño de flota">
          <SelectDropdown value={f.flota} onChange={(v) => setF((s) => ({ ...s, flota: v }))} options={FLOTA} />
        </Field>
        <Field label="Mensaje">
          <textarea
            className={`${inputCls} min-h-20 resize-y`}
            value={f.mensaje}
            onChange={set("mensaje")}
            placeholder="Cuéntanos en qué podemos ayudarte…"
          />
        </Field>
        {err && <p className="text-sm font-medium text-rose-600">Completa nombre y email para continuar.</p>}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="rounded-lg border border-ink-1 bg-ink-1 px-6 py-3 text-sm font-medium text-page transition-colors hover:bg-ink-2 hover:border-ink-2"
          >
            Enviar mensaje
          </button>
          <p className="text-sm text-ink-3">Sin compromiso · Tus datos no se comparten con terceros.</p>
        </div>
      </form>
    </div>
  );
}

export default function SplashFlow() {
  const [view, setView] = useState<"hero" | "demo">("hero");
  const [direction, setDirection] = useState(1);

  const goDemo = () => {
    setDirection(1);
    setView("demo");
  };
  const goBack = () => {
    setDirection(-1);
    setView("hero");
  };

  return (
    <div className="relative w-full">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={view}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === "hero" ? <HeroView onDemo={goDemo} /> : <DemoView onBack={goBack} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

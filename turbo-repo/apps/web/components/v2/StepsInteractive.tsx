"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getContent } from "./content";
import { useLang } from "./useLang";

// Stepper interactivo autoreproducido (estilo "5 simples pasos" de luuk.cl):
// fila de indicadores con el activo resaltado + tarjeta-mockup que cambia sola.

const stepIcons: React.ReactNode[] = [
  // 01 captura de señal (antena)
  <path key="a" strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M12 12h.008v.008H12V12z" />,
  // 02 stream (rayo)
  <path key="b" strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
  // 03 síntoma (radar)
  <path key="c" strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m12.75 0a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />,
  // 04 workflow (conexión)
  <path key="d" strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />,
  // 05 evidencia (documento)
  <path key="e" strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
];

export default function StepsInteractive() {
  const c = getContent(useLang()).steps;
  const steps = c.items;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 3000);
    return () => clearInterval(t);
  }, [paused, steps.length]);

  const step = steps[active];

  return (
    <section id="como-funciona" className="scroll-mt-16 border-y border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-semibold tracking-widest text-blue-600 uppercase">{c.kicker}</p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">{c.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">{c.subtitle}</p>
        </div>

        <div
          className="mt-16"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Fila de indicadores */}
          <div className="relative mx-auto grid max-w-4xl grid-cols-5 gap-2">
            {/* línea base */}
            <div className="absolute top-7 right-[10%] left-[10%] -z-0 hidden h-0.5 bg-gray-200 sm:block" />
            {steps.map((s, i) => {
              const isActive = i === active;
              const isDone = i < active;
              return (
                <button
                  key={s.n}
                  onClick={() => setActive(i)}
                  className="relative z-10 flex flex-col items-center gap-2 focus:outline-none"
                  aria-label={`Paso ${i + 1}: ${s.title}`}
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                      isActive
                        ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-110"
                        : isDone
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-300 bg-white text-gray-400"
                    }`}
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      {stepIcons[i]}
                    </svg>
                  </span>
                  <span className={`text-center text-xs font-medium sm:text-sm ${isActive ? "text-gray-950" : "text-gray-500"}`}>
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tarjeta-mockup que cambia */}
          <div className="mx-auto mt-12 max-w-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl border border-gray-200 bg-white p-8 text-center"
              >
                <span className="inline-block rounded bg-gray-950 px-2.5 py-1 font-mono text-[11px] font-semibold text-blue-300">
                  {step.tag}
                </span>
                <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                    {stepIcons[active]}
                  </svg>
                </div>
                <h3 className="mt-5 text-xl font-bold text-gray-950">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-md leading-relaxed text-gray-600">{step.body}</p>
                <p className="mt-5 text-sm text-gray-400">
                  Paso <span className="font-bold text-blue-600">{active + 1}</span> de {steps.length}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* barra de progreso */}
            <div className="mx-auto mt-6 flex max-w-xs justify-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`Ir al paso ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === active ? "w-8 bg-blue-600" : "w-1.5 bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

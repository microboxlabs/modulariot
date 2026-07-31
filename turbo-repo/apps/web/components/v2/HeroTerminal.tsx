"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

// Tarjeta "pipeline" del DS: la operación en vivo contada en el vocabulario
// del producto — señal → síntoma → acción → registro — cada etapa con su
// color semántico. Los eventos aparecen en secuencia y reinician en loop.

const KIND: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  signal: {
    color: "text-signal",
    bg: "bg-signal/10",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M12 12h.008v.008H12V12z" />
    ),
  },
  symptom: {
    color: "text-symptom",
    bg: "bg-symptom/10",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    ),
  },
  action: {
    color: "text-action",
    bg: "bg-action/10",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    ),
  },
  record: {
    color: "text-ink-2",
    bg: "bg-surface-3",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 0v3.75m-16.5-3.75v3.75" />
    ),
  },
};

// Orden fijo, alineado por índice con hero.livePanel.events en los JSON de
// traducción — el "kind" no es texto, así que vive en código, no en i18n.
const EVENT_KINDS = ["signal", "symptom", "action", "record"];

type LiveEvent = { title: string; detail: string };

export default function HeroTerminal() {
  const t = useTranslations("hero.livePanel");
  const events = t.raw("events") as LiveEvent[];
  const [count, setCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setCount((n) => (n >= events.length ? 0 : n + 1));
    }, 1200);
    return () => clearInterval(t);
  }, [events.length]);

  return (
    <div className="mx-auto mt-12 w-full max-w-2xl lg:mx-0 lg:mt-0 z-10">
      <div className="overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-[0_30px_60px_-30px_rgba(15,23,42,0.18),0_1px_3px_rgba(15,23,42,0.04)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        {/* Encabezado del panel — instrumento, no navegador */}
        <div className="flex items-center justify-between border-b border-hairline bg-surface-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
            </span>
            <p className="font-mono text-xs text-ink-3">modulariot · {t("title").toLowerCase()}</p>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-action opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-action" />
            </span>
            {t("subtitle")}
          </span>
        </div>

        {/* Feed de eventos — todos los items quedan montados (visibilidad vía
            opacity) para que el alto del panel no salte cuando el ciclo reinicia. */}
        <div className="space-y-2 px-4 py-4">
          {events.map((e, i) => {
            const k = KIND[EVENT_KINDS[i]] || KIND.record;
            const visible = i < count;
            return (
              <motion.div
                key={e.title}
                initial={false}
                animate={{ opacity: visible ? 1 : 0, x: visible ? 0 : -8 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-2 px-3 py-2.5"
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${k.bg} ${k.color}`}>
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                    {k.icon}
                  </svg>
                </span>
                <div className="leading-snug">
                  <p className="text-sm font-medium text-ink-1">{e.title}</p>
                  <p className="text-[13px] text-ink-3">{e.detail}</p>
                </div>
              </motion.div>
            );
          })}
          <div className="flex items-center gap-2 pt-1 font-mono text-xs text-ink-4">
            <span className="inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-ink-4" />
            <span>{count >= events.length ? t("done") : t("live")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

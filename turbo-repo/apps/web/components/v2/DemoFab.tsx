"use client";

import { usePathname } from "next/navigation";

// ============================================================
// Botón flotante "Solicitar demo" — persistente en toda la navegación.
// Acordado en revisión comercial: CTA prominente a demo técnica (no autoservicio).
// Se oculta en la propia página de contacto.
// ============================================================

const LABEL: Record<string, string> = {
  es: "Solicitar demo",
  en: "Request a demo",
  pt: "Solicitar demo",
};

export default function DemoFab({ lang = "es" }: { lang?: string }) {
  const pathname = usePathname() || "";
  if (pathname.includes("/contacto")) return null;
  const base = `/alpha-2506/${lang}`;

  return (
    <a
      href={`${base}/contacto?intent=demo`}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-black/5 transition-colors hover:bg-blue-700 sm:bottom-6 sm:right-6"
      aria-label={LABEL[lang] || LABEL.es}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
      {LABEL[lang] || LABEL.es}
    </a>
  );
}

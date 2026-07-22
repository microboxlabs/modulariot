import Link from "next/link";

// ============================================================
// Sub-navegación entre los 4 módulos en vivo. Los entrelaza como una
// sola experiencia (Ver → Entender → Gestionar → Medir) en vez de 4
// páginas sueltas. Se coloca bajo el Nav en cada página de módulo.
// ============================================================

export type ModuleKey = "torre" | "superprofile" | "canales" | "gps";
type Lang = "es" | "en" | "pt";

const MODULES: { key: ModuleKey; href: string }[] = [
  { key: "torre", href: "/torre" },
  { key: "superprofile", href: "/superprofile" },
  { key: "canales", href: "/canales" },
  { key: "gps", href: "/proveedores-gps" },
];

const LABELS: Record<Lang, Record<ModuleKey, { step: string; name: string }>> = {
  es: {
    torre: { step: "Ver", name: "Torre de control" },
    superprofile: { step: "Entender", name: "SuperProfile" },
    canales: { step: "Gestionar", name: "Canales" },
    gps: { step: "Medir", name: "Proveedores GPS" },
  },
  en: {
    torre: { step: "See", name: "Control tower" },
    superprofile: { step: "Understand", name: "SuperProfile" },
    canales: { step: "Act", name: "Channels" },
    gps: { step: "Measure", name: "GPS providers" },
  },
  pt: {
    torre: { step: "Ver", name: "Torre de controle" },
    superprofile: { step: "Entender", name: "SuperProfile" },
    canales: { step: "Gerir", name: "Canais" },
    gps: { step: "Medir", name: "Provedores GPS" },
  },
};

const INTRO: Record<Lang, string> = {
  es: "La operación real, en 4 movimientos",
  en: "The real operation, in 4 moves",
  pt: "A operação real, em 4 movimentos",
};

export default function ModuleTabs({ base, active, lang = "es" }: { base: string; active: ModuleKey; lang?: Lang }) {
  const L = LABELS[lang] || LABELS.es;
  return (
    <div className="sticky top-16 z-30 border-b border-hairline bg-page/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-4 py-3 sm:px-6">
        <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-3 md:inline">
          {INTRO[lang] || INTRO.es}
        </span>
        <div className="flex items-center gap-2">
          {MODULES.map((m, i) => {
            const on = m.key === active;
            const l = L[m.key];
            return (
              <div key={m.key} className="flex items-center gap-2">
                {i > 0 && <span className="text-hairline-strong" aria-hidden>·</span>}
                <Link
                  href={`${base}${m.href}`}
                  aria-current={on ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    on ? "border-accent bg-accent text-white" : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong"
                  }`}
                >
                  <span className={`text-[11px] font-semibold uppercase ${on ? "text-blue-100" : "text-ink-3"}`}>{l.step}</span>
                  {l.name}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

// ============================================================
// Sub-navegación entre los módulos en vivo. El flujo narrativo son 3
// movimientos (Ver → Entender → Gestionar), espejo de los 3 actos de la
// home. Calidad de señal no es un movimiento del flujo: es observabilidad
// transversal, así que va aparte, con su propio rótulo. Se coloca bajo el
// Nav en cada página de módulo.
// ============================================================

export type ModuleKey = "torre" | "superprofile" | "canales" | "gps";
type Lang = "es" | "en" | "pt";

const MODULES: { key: ModuleKey; href: string }[] = [
  { key: "torre", href: "/torre" },
  { key: "superprofile", href: "/superprofile" },
  { key: "canales", href: "/canales" },
];

const OBS_MODULE: { key: ModuleKey; href: string } = {
  key: "gps",
  href: "/proveedores-gps",
};

// Un ícono por módulo — el mismo trazo (Heroicons outline) que el resto del DS.
const ICONS: Record<ModuleKey, React.ReactNode> = {
  torre: (
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 100-6 3 3 0 000 6Z" />
  ),
  superprofile: (
    <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  ),
  canales: (
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0" />
  ),
  gps: (
    <path d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12z" />
  ),
};

const LABELS: Record<Lang, Record<ModuleKey, string>> = {
  es: {
    torre: "Ver",
    superprofile: "Entender",
    canales: "Gestionar",
    gps: "Calidad de señal",
  },
  en: {
    torre: "See",
    superprofile: "Understand",
    canales: "Act",
    gps: "Signal quality",
  },
  pt: {
    torre: "Ver",
    superprofile: "Entender",
    canales: "Gerir",
    gps: "Qualidade do sinal",
  },
};

const INTRO: Record<Lang, string> = {
  es: "La operación real, en 3 movimientos",
  en: "The real operation, in 3 moves",
  pt: "A operação real, em 3 movimentos",
};

const OBS_LABEL: Record<Lang, string> = {
  es: "Observabilidad",
  en: "Observability",
  pt: "Observabilidade",
};

export default function ModuleTabs({
  base,
  active,
  lang = "es",
}: {
  base: string;
  active: ModuleKey;
  lang?: Lang;
}) {
  const L = LABELS[lang] || LABELS.es;

  const pill = (m: { key: ModuleKey; href: string }) => {
    const on = m.key === active;
    return (
      <Link
        key={m.key}
        href={`${base}${m.href}`}
        aria-current={on ? "page" : undefined}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
          on
            ? "border-accent bg-accent text-white"
            : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong"
        }`}
      >
        <svg
          className="h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICONS[m.key]}
        </svg>
        {L[m.key]}
      </Link>
    );
  };

  return (
    <div className="border-hairline bg-page/90 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-4 py-3 sm:px-6">
        <span className="text-ink-3 hidden shrink-0 text-xs font-semibold tracking-wide uppercase md:inline">
          {INTRO[lang] || INTRO.es}
        </span>
        <div className="flex items-center gap-2">{MODULES.map(pill)}</div>
        <span
          className="bg-hairline hidden h-5 w-px shrink-0 sm:block"
          aria-hidden="true"
        />
        <div className="flex items-center gap-2">
          <span className="text-ink-3 hidden shrink-0 text-xs font-semibold tracking-wide uppercase lg:inline">
            {OBS_LABEL[lang] || OBS_LABEL.es}
          </span>
          {pill(OBS_MODULE)}
        </div>
      </div>
    </div>
  );
}

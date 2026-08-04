import { Reveal } from "../Reveal";

// ============================================================
// Primitivas del Design System para la landing.
// tone: "white" | "gray" define el ritmo alternado de superficies;
// ambos tonos resuelven claro/oscuro vía tokens semánticos.
// ============================================================
export type Tone = "white" | "gray";

export const toneClasses: Record<Tone, string> = {
  white: "bg-page",
  gray: "bg-page-alt border-y border-hairline",
};

// Botones del DS: primaria en tinta (nunca azul), secundaria en superficie.
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-ink-1 bg-ink-1 px-5 py-3 text-sm font-medium text-page transition-colors hover:bg-ink-2 hover:border-ink-2";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-hairline-strong bg-surface px-5 py-3 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-3";
export const btnLg = "px-6 py-3.5 text-[15px]";

export function Section({
  id,
  tone = "white",
  children,
  className = "",
  contentClassName = "py-16 sm:py-20 lg:py-24",
}: {
  id?: string;
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  /** Padding vertical del contenedor interno — cada sección puede traer su
   * propio ritmo (Hero, Stats, etc.) en vez del default de "py grande". */
  contentClassName?: string;
}) {
  return (
    <section id={id} className={`relative overflow-hidden scroll-mt-16 ${toneClasses[tone]} ${className}`}>
      {/* La cuadrícula del hero solo se repite en superficies claras/"no gris"
          (tone="white") — el tono "gray" ya trae su propio contraste con
          bg-page-alt + hairlines, así que no la necesita. */}
      {tone === "white" && <div className="hero-bg" aria-hidden />}
      <div className={`relative mx-auto max-w-7xl px-6 ${contentClassName}`}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-accent uppercase">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      {children}
    </p>
  );
}

// Cabecera de sección del DS: alineada a la izquierda, ancho de lectura.
export function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <Reveal className="max-w-[800px]">
      <Eyebrow>{kicker}</Eyebrow>
      <h2 className="display mt-4 text-[clamp(30px,3.8vw,46px)] leading-[1.1] whitespace-pre-line">{title}</h2>
      {subtitle && (
        <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed whitespace-pre-line text-ink-2">{subtitle}</p>
      )}
    </Reveal>
  );
}

export const icons: Record<string, React.ReactNode> = {
  signal: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12z" />
  ),
  radar: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
  ),
  plug: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  ),
  video: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
  ),
};

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      {icons[name]}
    </svg>
  );
}

export const Check = ({ className = "" }: { className?: string }) => (
  <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

export const ArrowRight = ({ className = "" }: { className?: string }) => (
  <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h15m0 0l-6-6m6 6l-6 6" />
  </svg>
);

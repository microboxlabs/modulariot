import { Reveal } from "../Reveal";

// ============================================================
// Helpers de layout — separación visual consistente entre secciones.
// tone: "white" | "gray" | "dark" define el fondo y crea el ritmo alternado.
// ============================================================
export type Tone = "white" | "gray" | "dark";

export const toneClasses: Record<Tone, string> = {
  white: "bg-white",
  gray: "bg-gray-50 border-y border-gray-100",
  dark: "bg-gray-800",
};

export function Section({
  id,
  tone = "white",
  children,
  className = "",
}: {
  id?: string;
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-16 ${toneClasses[tone]} ${className}`}>
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:py-32">{children}</div>
    </section>
  );
}

export function SectionHeader({
  kicker,
  title,
  subtitle,
  dark = false,
}: {
  kicker: string;
  title: React.ReactNode;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <p className="mb-4 text-sm font-semibold tracking-widest text-blue-600 uppercase">{kicker}</p>
      <h2
        className={`text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl ${
          dark ? "text-white" : "text-gray-950"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-6 text-lg leading-relaxed ${dark ? "text-gray-300" : "text-gray-600"}`}>
          {subtitle}
        </p>
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

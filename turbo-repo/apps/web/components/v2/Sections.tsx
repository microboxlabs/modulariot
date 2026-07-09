import { getContent } from "./content";
import { Reveal } from "./Reveal";
import HeroTerminal from "./HeroTerminal";
import { ConceptGraphic } from "./ConceptGraphic";

// ============================================================
// Helpers de layout — separación visual consistente entre secciones.
// tone: "white" | "gray" | "dark" define el fondo y crea el ritmo alternado.
// ============================================================
type Tone = "white" | "gray" | "dark";

const toneClasses: Record<Tone, string> = {
  white: "bg-white",
  gray: "bg-gray-50 border-y border-gray-100",
  dark: "bg-gray-950",
};

function Section({
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

function SectionHeader({
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

const icons: Record<string, React.ReactNode> = {
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

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      {icons[name]}
    </svg>
  );
}

const Check = ({ className = "" }: { className?: string }) => (
  <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const ArrowRight = ({ className = "" }: { className?: string }) => (
  <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h15m0 0l-6-6m6 6l-6 6" />
  </svg>
);

// ============================== HERO ==============================
export function Hero({ base, lang }: { base: string; lang: string }) {
  const c = getContent(lang).hero;
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:pt-28 lg:pb-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-6 inline-block rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-xs font-medium text-gray-600">
            {c.kicker}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-950 sm:text-6xl lg:text-7xl">
            {c.titlePre}
            <span className="relative inline-block px-1">
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-[0.12em] top-[0.18em] -z-10 -rotate-1 rounded-[0.15em] bg-yellow-300"
              />
              {c.titleHighlight}
            </span>
            {c.titlePost}
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-gray-600">{c.subtitle}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#contacto"
              className="w-full rounded-lg bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto"
            >
              {c.ctaPrimary}
            </a>
            <a
              href={`${base}/precios`}
              className="w-full rounded-lg border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-950 transition-colors hover:border-gray-950 sm:w-auto"
            >
              {c.ctaSecondary}
            </a>
          </div>
        </div>

        {/* Pipeline en vivo (animado) */}
        <HeroTerminal />
      </div>
    </section>
  );
}

// ============================== STATS (banda oscura) ==============================
export function Stats({ lang }: { lang: string }) {
  const c = getContent(lang).stats;
  return (
    <section className="bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <p className="mb-12 text-center text-sm font-medium tracking-wide text-gray-400">{c.title}</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
          {c.items.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {s.value}
              </p>
              <p className="mt-3 text-sm text-gray-300">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================== PROBLEM (feed We Got You) ==============================
export function Problem({ lang }: { lang: string }) {
  const c = getContent(lang).problem;
  return (
    <Section tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {c.pains.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.1} className="rounded-xl border border-gray-200 bg-white p-8">
            <h3 className="text-xl font-bold text-gray-950">{p.title}</h3>
            <p className="mt-4 leading-relaxed text-gray-600">{p.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// (El stepper de "Cómo funciona" vive en StepsInteractive.tsx)

// ============================== FEATURES (code cards) ==============================
// ============================== TESIS · 3 ACTOS ==============================
// Núcleo narrativo disruptivo. Cada acto abre su módulo nativo en el sitio.
const actos = (base: string) => [
  {
    n: "Acto 1",
    tag: "Ver y reducir",
    title: "Tratas cada alerta. Las desviaciones vuelven igual.",
    body: "97% de los síntomas se trata… y la mayoría se invalida. Cerrar no es resolver: atacamos la causa que los genera en serie, no el ticket.",
    cta: "Explora la torre de control",
    href: `${base}/torre`,
  },
  {
    n: "Acto 2",
    tag: "Entender a cada actor",
    title: "No un score. Un perfil vivo.",
    body: "La identidad operacional de cada conductor, transportista y activo — su historia, su nivel y su plan. Un mismo motor para cualquier entidad.",
    cta: "Ver SuperProfile",
    href: `${base}/superprofile`,
  },
  {
    n: "Acto 3",
    tag: "Gestionar donde vive la operación",
    title: "La alerta llega con plan y dueño.",
    body: "Correo, WhatsApp, Teams, Webex o SMS. Escalar deja de ser un aviso y pasa a ser el primer paso de la gestión.",
    cta: "Ver canales de escalamiento",
    href: `${base}/canales`,
  },
];

export function TresActos({ base }: { base: string }) {
  const ACTOS = actos(base);
  return (
    <Section id="tesis" tone="white">
      <SectionHeader
        kicker="La tesis, en 3 actos"
        title="Detectar es barato. Reducir es el negocio."
        subtitle="La misma inteligencia en tres movimientos: reducir la desviación, entender a cada actor y gestionar donde vive la operación. Todo sobre una operación real — no una demo."
      />
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {ACTOS.map((a, i) => (
          <Reveal
            key={a.n}
            delay={i * 0.08}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-md"
          >
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              {a.n} · {a.tag}
            </p>
            <h3 className="mt-3 text-xl font-bold text-gray-950">{a.title}</h3>
            <p className="mt-3 flex-1 leading-relaxed text-gray-600">{a.body}</p>
            <a
              href={a.href}
              className="mt-6 inline-flex items-center gap-1.5 font-semibold text-blue-700 transition-colors hover:text-blue-900"
            >
              {a.cta} <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </Reveal>
        ))}
      </div>
      <Reveal className="mx-auto mt-10 max-w-2xl text-center">
        <p className="text-sm text-gray-500">
          Lo que ves en el explorador es una operación real (junio 2026), no una maqueta.
        </p>
      </Reveal>
    </Section>
  );
}

// ============================== CONFIABILIDAD DE SEÑAL ==============================
// Diferenciador de precisión (pulsos/min vs estándar 12/20). Gancho para minería.
export function Confiabilidad({ base }: { base: string }) {
  const FLEET = 3.96,
    STD_MBL = 12,
    STD_MIN = 20,
    GMAX = 24;
  const px = (v: number) => (v / GMAX) * 100;
  return (
    <Section id="confiabilidad" tone="white">
      <SectionHeader
        kicker="Confiabilidad de la señal"
        title="12 pulsos por minuto. El estándar de precisión que marca la diferencia."
        subtitle="La precisión depende de la frecuencia de la señal en movimiento. 12 pulsos por minuto es el estándar de ModularIoT; 20 el que exige la minería. Integramos +28 proveedores GPS y elevamos su señal a esa vara."
      />
      <Reveal className="mx-auto mt-14 max-w-3xl rounded-xl border border-gray-200 bg-white p-8 sm:p-10">
        {/* Medidor */}
        <div className="relative">
          <div className="relative h-9 overflow-hidden rounded-lg bg-gray-100">
            <div className="absolute inset-y-0 left-0 rounded-lg bg-amber-500/85" style={{ width: `${px(FLEET)}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-green-600" style={{ left: `${px(STD_MBL)}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-green-800" style={{ left: `${px(STD_MIN)}%` }} />
          </div>
          <div className="relative mt-2 h-5 text-xs font-semibold">
            <span className="absolute -translate-x-1/2 text-amber-700" style={{ left: `${px(FLEET)}%` }}>
              Flota 3.96
            </span>
            <span className="absolute -translate-x-1/2 text-green-700" style={{ left: `${px(STD_MBL)}%` }}>
              12 · ModularIoT
            </span>
            <span className="absolute -translate-x-1/2 text-green-900" style={{ left: `${px(STD_MIN)}%` }}>
              20 · Minería
            </span>
          </div>
        </div>
        {/* Números */}
        <div className="mt-12 grid gap-6 border-t border-gray-100 pt-8 sm:grid-cols-3">
          <div className="text-center">
            <p className="text-4xl font-extrabold text-gray-950">3.96</p>
            <p className="mt-1 text-sm text-gray-600">pulsos/min promedio de la flota hoy</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-extrabold text-green-700">12/min</p>
            <p className="mt-1 text-sm text-gray-600">el estándar de precisión de ModularIoT</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-extrabold text-gray-950">20/min</p>
            <p className="mt-1 text-sm text-gray-600">el estándar que exige la minería</p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <a
            href={`${base}/proveedores-gps`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-950 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Analiza tus proveedores GPS <ArrowRight />
          </a>
          <p className="mt-6 text-xs text-gray-400">
            Datos reales de proveedores GPS en operación — medidos, no simulados.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

export function Features({ lang }: { lang: string }) {
  const c = getContent(lang).features;
  return (
    <Section id="caracteristicas" tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {c.cards.map((card, i) => (
          <Reveal key={card.title} delay={i * 0.1} className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
            <h3 className="px-6 pt-6 text-lg font-bold text-gray-950">{card.title}</h3>
            <pre className="mt-4 flex-1 overflow-x-auto bg-gray-950 p-5 font-mono text-xs leading-relaxed text-gray-100">
              {card.code}
            </pre>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ============================== USE CASES ==============================
export function UseCases({ lang }: { lang: string }) {
  const c = getContent(lang).useCases;
  return (
    <Section id="casos-de-uso" tone="gray">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-16 grid gap-6 md:grid-cols-2">
        {c.cards.map((card, i) => (
          <Reveal key={card.id} delay={i * 0.08} className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
            <div className="overflow-hidden">
              <div className="transition-transform duration-500 group-hover:scale-[1.03]">
                <ConceptGraphic id={card.id} />
              </div>
            </div>
            <div className="flex-1 p-8">
              <h3 className="text-xl font-bold text-gray-950">{card.title}</h3>
              <p className="mt-3 leading-relaxed text-gray-600">{card.body}</p>
              <ul className="mt-5 space-y-2">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 text-blue-600" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ============================== PAIN / OUTCOME (rentar vs poseer) ==============================
export function PainOutcome({ lang }: { lang: string }) {
  const c = getContent(lang).painOutcome;
  return (
    <Section tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} />
      <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          <h3 className="text-lg font-bold text-gray-500">{c.left.title}</h3>
          <ul className="mt-5 space-y-3">
            {c.left.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-gray-500">
                <svg className="mt-1 h-4 w-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border-2 border-blue-600 bg-white p-8 shadow-lg">
          <h3 className="text-lg font-bold text-gray-950">{c.right.title}</h3>
          <ul className="mt-5 space-y-3">
            {c.right.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-gray-800">
                <Check className="mt-1 text-blue-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

// ============================== ARCHITECTURE ==============================
export function Architecture({ lang }: { lang: string }) {
  const c = getContent(lang).architecture;
  return (
    <Section id="arquitectura" tone="gray">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {c.steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.12} className="relative rounded-xl border border-gray-200 bg-white p-8">
            <span className="text-5xl font-extrabold text-gray-200">{s.n}</span>
            <h3 className="mt-4 text-xl font-bold text-gray-950">{s.title}</h3>
            <p className="mt-3 leading-relaxed text-gray-600">{s.body}</p>
            {i < c.steps.length - 1 && (
              <svg className="absolute top-1/2 -right-5 hidden h-6 w-6 -translate-y-1/2 text-gray-300 md:block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            )}
          </Reveal>
        ))}
      </div>
      <Reveal className="mx-auto mt-10 max-w-2xl rounded-xl bg-gray-950 p-8 text-center">
        <p className="text-2xl font-bold text-blue-600">{c.latency}</p>
        <p className="mt-2 text-sm text-gray-400">{c.latencySubtitle}</p>
      </Reveal>
    </Section>
  );
}

// ============================== DEPLOYMENT ==============================
export function Deployment({ lang }: { lang: string }) {
  const c = getContent(lang).deployment;
  return (
    <Section id="implementacion" tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {c.options.map((opt, i) => (
          <Reveal
            key={opt.title}
            delay={i * 0.1}
            className={`rounded-xl border bg-white p-8 ${i === 0 ? "border-2 border-blue-600 shadow-lg" : "border-gray-200"}`}
          >
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                i === 0 ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              {opt.highlight}
            </span>
            <h3 className="mt-4 text-xl font-bold text-gray-950">{opt.title}</h3>
            <p className="mt-3 leading-relaxed text-gray-600">{opt.description}</p>
            <ul className="mt-5 space-y-2">
              {opt.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="mt-0.5 text-blue-600" />
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ============================== STORIES (prueba social) ==============================
export function Stories({ lang }: { lang: string }) {
  const c = getContent(lang).stories;
  return (
    <Section id="clientes" tone="gray">
      <SectionHeader kicker={c.kicker} title={c.title} />
      <Reveal className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-6 rounded-xl border border-gray-200 bg-white px-6 py-8 sm:grid-cols-4">
        {c.metrics.map((m) => (
          <div key={m.label} className="text-center">
            <p className="text-3xl font-extrabold tracking-tight text-gray-950">{m.value}</p>
            <p className="mt-1 text-xs leading-snug text-gray-500">{m.label}</p>
          </div>
        ))}
      </Reveal>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {c.cases.map((cs, i) => (
          <Reveal key={cs.tag} delay={i * 0.1} className="rounded-xl border border-gray-200 bg-white p-8">
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              Caso real · {cs.tag}
            </span>
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Antes</p>
                <p className="mt-2 leading-relaxed text-gray-600">{cs.before}</p>
              </div>
              <div className="border-l-2 border-blue-600 pl-4">
                <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">Con ModularIoT</p>
                <p className="mt-2 leading-relaxed text-gray-800">{cs.after}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {c.quotes.map((q, i) => (
          <Reveal key={q.author} delay={i * 0.1} as="div">
            <figure className="rounded-xl bg-gray-950 p-8 text-white">
              <blockquote className="text-lg leading-relaxed font-medium">“{q.text}”</blockquote>
              <figcaption className="mt-4 text-sm text-gray-400">— {q.author}</figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ============================== PRICING TEASER ==============================
export function PricingTeaser({ base, lang }: { base: string; lang: string }) {
  const c = getContent(lang).pricingTeaser;
  return (
    <Section tone="white">
      <div className="rounded-2xl bg-gray-950 p-10 text-center sm:p-16">
        <p className="mb-4 text-sm font-semibold tracking-widest text-blue-400 uppercase">{c.kicker}</p>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">{c.title}</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">{c.subtitle}</p>
        <a
          href={`${base}/precios`}
          className="mt-8 inline-block rounded-lg bg-blue-600 px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-blue-700"
        >
          {c.cta}
        </a>
      </div>
    </Section>
  );
}

// ============================== FINAL CTA ==============================
export function FinalCta({ lang }: { lang: string }) {
  const c = getContent(lang).finalCta;
  return (
    <section id="contacto" className="scroll-mt-16 bg-gray-950">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:py-28">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">{c.title}</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-300">{c.body}</p>
        <a
          href={`/alpha-2506/${lang}/contacto?intent=demo`}
          className="mt-10 inline-block rounded-lg bg-blue-600 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-blue-700"
        >
          {c.cta}
        </a>
        <p className="mt-5 text-sm text-gray-400">{c.note}</p>
        <div className="mt-12 grid grid-cols-3 gap-6 border-t border-gray-800 pt-10">
          {c.stats.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-extrabold text-white sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-gray-400 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================== FOOTER ==============================
export function Footer({ base, lang }: { base: string; lang: string }) {
  const c = getContent(lang).footer;
  return (
    <footer className="border-t border-gray-800 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <img src="/headlogo-dark.svg" alt="ModularIoT" className="h-6 w-auto" />
              <span className="font-bold text-white">
                Modular<span className="text-yellow-400">IoT</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-400">{c.description}</p>
          </div>
          {c.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href.startsWith("http") || link.href.startsWith("mailto:") ? link.href : `${base}${link.href}`}
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 border-t border-gray-800 pt-6 text-xs text-gray-500">{c.copyright}</p>
      </div>
    </footer>
  );
}

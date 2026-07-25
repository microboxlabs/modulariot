import Nav from "./Nav";
import { Footer } from "./sections/Footer";
import { getContent } from "./content";
import { Reveal } from "./Reveal";
import { ConceptGraphic } from "./ConceptGraphic";
import { StatsGrid } from "./StatsGrid";
import { btnPrimary, btnLg } from "./sections/shared";

// ============================================================
// Renderizador de páginas de detalle basado en datos.
// Cada página (producto/solución/recurso) se define como un objeto DetailPageData
// en detail-content.ts y se renderiza con bloques tipados, alternando fondos.
// ============================================================

export type Block =
  | { type: "split"; kicker?: string; title: string; body: string; bullets: string[]; code?: string }
  | { type: "grid"; id?: string; kicker?: string; title: string; subtitle?: string; cards: { icon?: string; title: string; body: string }[] }
  | { type: "steps"; kicker?: string; title: string; subtitle?: string; steps: { n: string; title: string; body: string }[] }
  | { type: "code"; kicker?: string; title: string; subtitle?: string; cards: { title: string; code: string }[] }
  | { type: "stats"; items: { value: string; label: string }[] }
  | {
      type: "linkgrid";
      kicker?: string;
      title: string;
      subtitle?: string;
      links: { title: string; body: string; href: string; external?: boolean }[];
    };

export interface DetailPageData {
  eyebrow: string;
  icon?: string;
  graphic?: string; // id de ConceptGraphic para el hero (páginas de producto)
  title: string;
  subtitle: string;
  blocks: Block[];
}

const detailIcons: Record<string, React.ReactNode> = {
  signal: <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12z" />,
  radar: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />,
  plug: <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />,
  video: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />,
  code: <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />,
  stack: <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />,
  cloud: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />,
  shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />,
  bolt: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
  truck: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />,
  chart: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />,
  doc: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
  users: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
};

function DIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      {detailIcons[name] || detailIcons.stack}
    </svg>
  );
}

function Kicker({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <p className={`mb-4 text-sm font-semibold tracking-widest uppercase ${dark ? "text-blue-400" : "text-accent"}`}>{children}</p>;
}

const Check = () => (
  <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

function BlockView({ block, tone, base }: { block: Block; tone: "white" | "gray"; base: string }) {
  const wrap = `scroll-mt-16 ${tone === "gray" ? "bg-surface-2 border-y border-hairline" : "bg-surface"}`;
  const inner = "mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24";

  const Header = ({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) => (
    <Reveal className="mx-auto max-w-3xl text-center">
      {kicker && <Kicker>{kicker}</Kicker>}
      <h2 className="text-3xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-6 text-lg text-ink-2">{subtitle}</p>}
    </Reveal>
  );

  if (block.type === "split") {
    return (
      <section className={wrap}>
        <div className={`${inner} grid items-start gap-10 lg:grid-cols-2`}>
          <Reveal>
            {block.kicker && <Kicker>{block.kicker}</Kicker>}
            <h2 className="text-3xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-4xl">{block.title}</h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-2">{block.body}</p>
          </Reveal>
          <Reveal delay={0.12} className="rounded-xl border border-hairline bg-surface p-8">
            {block.code ? (
              <pre className="overflow-x-auto rounded-lg bg-gray-950 p-5 font-mono text-xs leading-relaxed text-gray-100">{block.code}</pre>
            ) : (
              <ul className="space-y-4">
                {block.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-ink-2">
                    <Check />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>
      </section>
    );
  }

  if (block.type === "grid") {
    return (
      <section id={block.id} className={wrap}>
        <div className={inner}>
          <Header kicker={block.kicker} title={block.title} subtitle={block.subtitle} />
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {block.cards.map((card, i) => (
              <Reveal key={card.title} delay={i * 0.07} className="rounded-xl border border-hairline bg-surface p-8 transition-shadow hover:shadow-md">
                {card.icon && (
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <DIcon name={card.icon} className="h-6 w-6" />
                  </div>
                )}
                <h3 className="text-lg font-semibold text-ink-1">{card.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-2">{card.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "steps") {
    return (
      <section className={wrap}>
        <div className={inner}>
          <Header kicker={block.kicker} title={block.title} subtitle={block.subtitle} />
          <div className="mx-auto mt-14 max-w-3xl space-y-4">
            {block.steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.06} className="flex gap-5 rounded-xl border border-hairline bg-surface p-6">
                <span className="text-2xl font-semibold tracking-[-0.02em] text-hairline">{s.n}</span>
                <div>
                  <h3 className="text-base font-semibold text-ink-1">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "code") {
    return (
      <section className={wrap}>
        <div className={inner}>
          <Header kicker={block.kicker} title={block.title} subtitle={block.subtitle} />
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {block.cards.map((card, i) => (
              <Reveal key={card.title} delay={i * 0.1} className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface">
                <h3 className="px-6 pt-6 text-lg font-semibold text-ink-1">{card.title}</h3>
                <pre className="mt-4 flex-1 overflow-x-auto bg-gray-950 p-5 font-mono text-xs leading-relaxed text-gray-100">{card.code}</pre>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "stats") {
    return (
      <section className="border-y border-ink-1 bg-ink-1 dark:border-hairline dark:bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <StatsGrid items={block.items} tone="dark" align="center" />
        </div>
      </section>
    );
  }

  // linkgrid
  return (
    <section className={wrap}>
      <div className={inner}>
        <Header kicker={block.kicker} title={block.title} subtitle={block.subtitle} />
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {block.links.map((link, i) => (
            <Reveal key={link.title} delay={i * 0.07}>
              <a
                href={link.external || link.href.startsWith("http") ? link.href : `${base}${link.href}`}
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group block h-full rounded-xl border border-hairline bg-surface p-8 transition-shadow hover:shadow-md"
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold text-ink-1">
                  {link.title}
                  <svg className="h-4 w-4 shrink-0 text-accent transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12h15m0 0l-6-6m6 6l-6 6" />
                  </svg>
                </h3>
                <p className="mt-3 leading-relaxed text-ink-2">{link.body}</p>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function DetailPage({ data, base }: { data: DetailPageData; base: string }) {
  const lang = base.split("/")[2] || "es";
  const t = getContent(lang);
  return (
    <>
      <Nav />
      <main>
        {/* Hero de la página de detalle */}
        <section className="border-b border-hairline bg-surface">
          <Reveal className="mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:px-6 lg:pt-24">
            <p className="mb-5 inline-block rounded-full border border-hairline bg-surface-2 px-4 py-1.5 text-xs font-semibold tracking-widest text-accent uppercase">
              {data.eyebrow}
            </p>
            {data.icon && !data.graphic && (
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <DIcon name={data.icon} className="h-7 w-7" />
              </div>
            )}
            <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-5xl lg:text-6xl">{data.title}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">{data.subtitle}</p>
            {data.graphic && (
              <div className="mx-auto mt-10 max-w-lg overflow-hidden rounded-xl border border-hairline">
                <ConceptGraphic id={data.graphic} />
              </div>
            )}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href={`${base}/#contacto`} className={`w-full sm:w-auto ${btnPrimary} ${btnLg}`}>
                {t.nav.cta}
              </a>
            </div>
          </Reveal>
        </section>

        {data.blocks.map((block, i) => (
          <BlockView key={i} block={block} tone={i % 2 === 0 ? "gray" : "white"} base={base} />
        ))}

        {/* CTA final */}
        <section className="border-y border-ink-1 bg-ink-1 dark:border-hairline dark:bg-surface">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-[-0.02em] text-page sm:text-4xl dark:text-ink-1">{t.finalCta.title}</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-page/70 dark:text-ink-2">{t.finalCta.body}</p>
            <a href={`${base}/contacto?intent=demo`} className="mt-10 inline-block rounded-lg bg-white px-8 py-4 text-base font-medium text-gray-950 transition-colors hover:bg-gray-100">
              {t.finalCta.cta}
            </a>
          </div>
        </section>
      </main>
      <Footer base={base} lang={lang} />
    </>
  );
}

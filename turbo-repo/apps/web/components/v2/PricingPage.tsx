import Nav from "./Nav";
import PricingTiers from "./PricingTiers";
import PricingFaq from "./PricingFaq";
import { Footer } from "./sections/Footer";
import { FinalCta } from "./sections/FinalCta";
import { getContent } from "./content";

// Página de precios completa — deliberadamente NO montada bajo app/ como ruta
// (ver app/alpha-2506/[lang]/precios/). Contiene datos que todavía no deben
// ser públicos; el componente vive aquí para no perder el trabajo, pero sin
// un page.tsx que la registre como ruta no hay URL ni bundle de cliente para
// ella. Para reactivarla: recrear app/alpha-2506/[lang]/precios/page.tsx
// importando y renderizando <PricingPage lang={lang} base={base} />.
export default function PricingPage({ lang, base }: { lang: "en" | "es" | "pt"; base: string }) {
  const c = getContent(lang).pricingPage;

  return (
    <>
      <Nav />
      <main>
        {/* Niveles (Ver · Notificar · Autonomía) + calculadora "a medida" — el título vive dentro,
            en el mismo bloque que el toggle y las tarjetas, en vez de una franja separada arriba */}
        <PricingTiers lang={lang} base={base} kicker={c.kicker} title={c.title} />

        {/* Filosofía de precios */}
        <section className="border-b border-hairline bg-surface-2">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="grid gap-10 md:grid-cols-3">
              {c.philosophy.map((p, i) => (
                <div key={p.title} className="text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <h2 className="mt-4 text-lg font-semibold text-ink-1">{p.title}</h2>
                  <p className="mt-2 leading-relaxed text-ink-2">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ de precios */}
        <PricingFaq />

        {/* CTA caso complejo */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <div className="rounded-2xl border border-hairline bg-surface-2 p-10 text-center sm:p-12">
            <h2 className="text-2xl font-semibold text-ink-1 sm:text-3xl">{c.cta.title}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-ink-2">{c.cta.body}</p>
            <a
              href={`${base}/contacto?intent=cotizar`}
              className="mt-8 inline-block rounded-lg border border-ink-1 bg-ink-1 px-8 py-3.5 font-medium text-page transition-colors hover:bg-ink-2 hover:border-ink-2"
            >
              {c.cta.button}
            </a>
          </div>
        </section>

        <FinalCta lang={lang} />
      </main>
      <Footer base={base} lang={lang} />
    </>
  );
}

import type { Metadata } from "next";
import Nav from "../../../../components/v2/Nav";
import PricingTiers from "../../../../components/v2/PricingTiers";
import PricingFaq from "../../../../components/v2/PricingFaq";
import { Footer } from "../../../../components/v2/sections/Footer";
import { FinalCta } from "../../../../components/v2/sections/FinalCta";
import { getContent } from "../../../../components/v2/content";

export const metadata: Metadata = {
  title: "Precios — ModularIoT",
  description:
    "Paga por activo, solo por lo que usas. Precios transparentes por caja de procesamiento, basados en costos reales de infraestructura.",
};

// Página de precios dedicada, guiada por clickhouse.com/pricing:
// header → filosofía → calculadora → FAQ de precios → CTA.
export default async function PreciosPage({
  params,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
}) {
  const { lang } = await params;
  const base = `/alpha-2506/${lang}`;
  const c = getContent(lang).pricingPage;

  return (
    <>
      <Nav />
      <main>
        {/* Header */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:px-6 lg:pt-24">
            <h1 className="text-5xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-6xl">{c.title}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">{c.subtitle}</p>
          </div>
        </section>

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

        {/* Niveles (Ver · Notificar · Autonomía) + calculadora "a medida" */}
        <PricingTiers lang={lang} base={base} />

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

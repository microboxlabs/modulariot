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
        <section className="border-b border-gray-100">
          <div className="mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:px-6 lg:pt-24">
            <h1 className="text-5xl font-extrabold tracking-tight text-gray-950 sm:text-6xl">{c.title}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">{c.subtitle}</p>
          </div>
        </section>

        {/* Filosofía de precios */}
        <section className="border-b border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="grid gap-10 md:grid-cols-3">
              {c.philosophy.map((p, i) => (
                <div key={p.title} className="text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-extrabold text-white">
                    {i + 1}
                  </span>
                  <h2 className="mt-4 text-lg font-bold text-gray-950">{p.title}</h2>
                  <p className="mt-2 leading-relaxed text-gray-600">{p.body}</p>
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
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-gray-950 sm:text-3xl">{c.cta.title}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-600">{c.cta.body}</p>
            <a
              href={`${base}/contacto?intent=cotizar`}
              className="mt-8 inline-block rounded-lg bg-gray-950 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-gray-800"
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

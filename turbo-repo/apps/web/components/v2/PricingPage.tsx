import { getTranslations } from "next-intl/server";
import PricingTiers from "./PricingTiers";
import PricingFaq from "./PricingFaq";
import { FinalCta } from "./sections/FinalCta";
import { Section, type Tone } from "./sections/shared";

type Philosophy = { title: string; body: string };

// Página de precios completa, montada en app/alpha-2506/[lang]/precios/.
export default async function PricingPage({ lang, base }: { lang: "en" | "es" | "pt"; base: string }) {
  const t = await getTranslations({ locale: lang, namespace: "pricing" });
  const philosophy = t.raw("philosophy") as Philosophy[];

  // Ritmo de superficies automático (mismo patrón que la home y el detalle):
  // blanco, gris, blanco... nada que tocar por sección.
  let toneIndex = 0;
  const tone = (): Tone => (toneIndex++ % 2 === 0 ? "white" : "gray");

  return (
    <main>
      {/* Niveles (Ver · Notificar · Autonomía) + calculadora "a medida" — el título vive dentro,
          en el mismo bloque que el toggle y las tarjetas, en vez de una franja separada arriba */}
      <PricingTiers lang={lang} base={base} kicker={t("page.kicker")} title={t("page.title")} tone={tone()} />

      {/* Filosofía de precios */}
      <Section tone={tone()} contentClassName="py-16 px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-3">
          {philosophy.map((p, i) => (
            <div key={p.title} className="text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h2 className="mt-4 text-lg font-semibold text-ink-1">{p.title}</h2>
              <p className="mt-2 leading-relaxed text-ink-2">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ de precios */}
      <PricingFaq tone={tone()} />

      {/* CTA caso complejo */}
      <Section tone={tone()}>
        <div className="rounded-2xl border border-hairline bg-surface-2 p-10 text-center sm:p-12">
          <h2 className="text-2xl font-semibold text-ink-1 sm:text-3xl">{t("cta.title")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-2">{t("cta.body")}</p>
          <a
            href={`${base}/contacto?intent=cotizar`}
            className="mt-8 inline-block rounded-lg border border-ink-1 bg-ink-1 px-8 py-3.5 font-medium text-page transition-colors hover:bg-ink-2 hover:border-ink-2"
          >
            {t("cta.button")}
          </a>
        </div>
      </Section>

      <FinalCta lang={lang} tone={tone()} />
    </main>
  );
}

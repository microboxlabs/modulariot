import { getTranslations } from "next-intl/server";
import { btnPrimary, btnLg } from "./shared";

type FinalCtaStat = { value: string; label: string };

// Cierre del DS: panel claro dentro de la página (no banda a sangre), cifras tabulares.
export async function FinalCta({ lang }: { lang: string }) {
  const t = await getTranslations({ locale: lang, namespace: "finalCta" });
  const stats = t.raw("stats") as FinalCtaStat[];
  return (
    <section id="contacto" className="scroll-mt-16 bg-page">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:py-24">
        <div className="rounded-2xl border border-hairline bg-surface px-8 py-14 text-center sm:px-16">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-[-0.025em] text-ink-1 sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-2">{t("body")}</p>
          <a href={`/alpha-2506/${lang}/contacto?intent=demo`} className={`mt-8 ${btnPrimary} ${btnLg}`}>
            {t("cta")}
          </a>
          <p className="mt-4 text-sm text-ink-3">{t("note")}</p>
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-6 border-t border-hairline pt-10">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-semibold tracking-[-0.02em] text-ink-1 tabular-nums sm:text-3xl">
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-ink-3 sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

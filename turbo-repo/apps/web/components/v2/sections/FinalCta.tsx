import { getTranslations } from "next-intl/server";
import { Section, btnPrimary, btnLg, type Tone } from "./shared";

type FinalCtaStat = { value: string; label: string };

// Cierre del DS: panel claro dentro de la página (no banda a sangre), cifras tabulares.
// tone es opcional: en la home, page.tsx la pasa según la alternancia
// automática; en las páginas de módulo (torre, canales, etc.) FinalCta se usa
// sola al final, así que cae al blanco que ya tenía antes.
export async function FinalCta({ lang, tone = "white" }: { lang: string; tone?: Tone }) {
  const t = await getTranslations({ locale: lang, namespace: "finalCta" });
  const stats = t.raw("stats") as FinalCtaStat[];
  return (
    <Section id="contacto" tone={tone}>
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
    </Section>
  );
}

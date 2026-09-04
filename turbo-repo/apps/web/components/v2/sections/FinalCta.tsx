import { getTranslations } from "next-intl/server";
import { Section, btnPrimary, btnLg, type Tone } from "./shared";

type FinalCtaStat = { value: string; label: string };

// Cierre del DS: panel claro dentro de la página (no banda a sangre), cifras tabulares.
// tone es opcional: en la home, page.tsx la pasa según la alternancia
// automática; en las páginas de módulo (torre, canales, etc.) FinalCta se usa
// sola al final, así que cae al blanco que ya tenía antes.
export async function FinalCta({
  lang,
  base,
  tone = "white",
  showStats = true,
}: {
  lang: string;
  base?: string;
  tone?: Tone;
  // Las cifras del cierre cuentan el camino evaluación→piloto→operación;
  // una página que ya lo narra en detalle (implementación) las omite.
  showStats?: boolean;
}) {
  const t = await getTranslations({ locale: lang, namespace: "finalCta" });
  const stats = t.raw("stats") as FinalCtaStat[];
  const routeBase = base ?? `/${lang}`;
  return (
    <Section id="contacto" tone={tone}>
      <div className="border-hairline bg-surface rounded-2xl border px-8 py-14 text-center sm:px-16">
        <h2 className="text-ink-1 mx-auto max-w-3xl text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
          {t("title")}
        </h2>
        <p className="text-ink-2 mx-auto mt-5 max-w-2xl text-base leading-relaxed">
          {t("body")}
        </p>
        <a
          href={`${routeBase}/contacto?intent=demo`}
          className={`mt-8 ${btnPrimary} ${btnLg}`}
        >
          {t("cta")}
        </a>
        <p className="text-ink-3 mt-4 text-sm">{t("note")}</p>
        {showStats && (
          <div className="border-hairline mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-6 border-t pt-10">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-ink-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums sm:text-3xl">
                  {s.value}
                </p>
                <p className="text-ink-3 mt-1 text-xs sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

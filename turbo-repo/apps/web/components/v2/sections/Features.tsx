import { getTranslations } from "next-intl/server";
import { Reveal } from "../Reveal";
import { Section, SectionHeader, Icon, Check, type Tone } from "./shared";

type FeatureCard = { title: string; body: string; bullets: string[] };

// Cada capacidad hereda el color de su etapa en el pipeline:
// señal (azul) → síntoma (ámbar) → acción (verde). Mismo código que el
// panel del hero, para que el color siga significando lo mismo. Los iconos
// no son texto, así que quedan en código, alineados por índice con "cards"
// del namespace features en los JSON de i18n.
const ICONS = ["signal", "radar", "plug"];
const stageTone: Record<string, { chip: string; check: string }> = {
  signal: { chip: "bg-signal/10 text-signal", check: "text-signal" },
  radar: { chip: "bg-symptom/10 text-symptom", check: "text-symptom" },
  plug: { chip: "bg-action/10 text-action", check: "text-action" },
};

export async function Features({ lang, tone }: { lang: string; tone: Tone }) {
  const t = await getTranslations({ locale: lang, namespace: "features" });
  const cards = t.raw("cards") as FeatureCard[];
  return (
    <Section id="caracteristicas" tone={tone}>
      <SectionHeader
        kicker={t("kicker")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <Reveal className="mt-8 flex justify-center">
        <p className="border-hairline bg-surface flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border px-6 py-2.5 text-center text-sm">
          <span className="text-ink-1 font-semibold">
            {t("taxonomy.modules")}
          </span>
          <span className="text-ink-3">{t("taxonomy.contain")}</span>
          <span className="text-ink-1 font-semibold">{t("taxonomy.rules")}</span>
          <span className="text-ink-3">{t("taxonomy.produce")}</span>
          <span className="text-accent font-semibold">
            {t("taxonomy.symptoms")}
          </span>
        </p>
      </Reveal>
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {cards.map((card, i) => {
          const icon = ICONS[i];
          const stage = stageTone[icon] ?? stageTone.signal;
          return (
            <Reveal
              key={card.title}
              delay={i * 0.1}
              className="border-hairline bg-surface hover:border-hairline-strong flex flex-col rounded-[14px] border p-6 transition-colors"
            >
              <div
                className={`mb-5 flex h-10 w-10 items-center justify-center rounded-lg ${stage.chip}`}
              >
                <Icon name={icon} className="h-5 w-5" />
              </div>
              <h3 className="text-ink-1 text-lg font-semibold tracking-[-0.01em]">
                {card.title}
              </h3>
              <p className="text-ink-2 mt-2 text-sm leading-relaxed">
                {card.body}
              </p>
              <ul className="mt-5 space-y-2">
                {card.bullets.map((b) => (
                  <li
                    key={b}
                    className="text-ink-2 flex items-start gap-2 text-sm"
                  >
                    <Check className={`mt-0.5 ${stage.check}`} />
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

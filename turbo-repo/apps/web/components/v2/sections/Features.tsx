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
      <SectionHeader kicker={t("kicker")} title={t("title")} subtitle={t("subtitle")} />
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {cards.map((card, i) => {
          const icon = ICONS[i];
          const tone = stageTone[icon] ?? stageTone.signal;
          return (
            <Reveal
              key={card.title}
              delay={i * 0.1}
              className="flex flex-col rounded-[14px] border border-hairline bg-surface p-6 transition-colors hover:border-hairline-strong"
            >
              <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-lg ${tone.chip}`}>
                <Icon name={icon} className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink-1">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{card.body}</p>
              <ul className="mt-5 space-y-2">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-ink-2">
                    <Check className={`mt-0.5 ${tone.check}`} />
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

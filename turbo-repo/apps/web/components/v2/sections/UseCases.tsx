import { getTranslations } from "next-intl/server";
import { Reveal } from "../Reveal";
import { ConceptGraphic } from "../ConceptGraphic";
import { Section, SectionHeader, Check } from "./shared";

type UseCaseCard = { title: string; body: string; bullets: string[] };

// Los ids de ConceptGraphic no son texto, así que quedan en código, alineados
// por índice con "cards" del namespace useCases en los JSON de i18n.
const CARD_IDS = ["ingesta", "sintomas", "integraciones", "video"];

export async function UseCases({ lang }: { lang: string }) {
  const t = await getTranslations({ locale: lang, namespace: "useCases" });
  const cards = t.raw("cards") as UseCaseCard[];
  return (
    <Section id="casos-de-uso" tone="white">
      <SectionHeader kicker={t("kicker")} title={t("title")} subtitle={t("subtitle")} />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {cards.map((card, i) => (
          <Reveal
            key={CARD_IDS[i]}
            delay={i * 0.08}
            className="flex flex-col overflow-hidden rounded-[14px] border border-hairline bg-surface transition-colors hover:border-hairline-strong"
          >
            <div className="border-b border-hairline">
              <ConceptGraphic id={CARD_IDS[i]} />
            </div>
            <div className="flex-1 p-6">
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink-1">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{card.body}</p>
              <ul className="mt-5 space-y-2">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-ink-2">
                    <Check className="mt-0.5 text-accent" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

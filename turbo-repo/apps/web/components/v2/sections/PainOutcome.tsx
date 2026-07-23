import { getTranslations } from "next-intl/server";
import { Section, SectionHeader, Check } from "./shared";

export async function PainOutcome({ lang }: { lang: string }) {
  const t = await getTranslations({ locale: lang, namespace: "painOutcome" });
  const leftItems = t.raw("left.items") as string[];
  const rightItems = t.raw("right.items") as string[];
  return (
    <Section tone="white">
      <SectionHeader kicker={t("kicker")} title={t("title")} />
      <div className="mt-12 order-2 grid overflow-hidden rounded-[14px] border border-hairline bg-surface sm:grid-cols-2 lg:order-1 lg:col-span-2">
        <div className="p-7">
          <h3 className="text-base font-semibold text-ink-3">{t("left.title")}</h3>
          <ul className="mt-5 space-y-3">
            {leftItems.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-ink-3">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-hairline bg-accent-soft p-7 sm:border-t-0 sm:border-l-2 sm:border-accent">
          <h3 className="text-base font-semibold text-ink-1">{t("right.title")}</h3>
          <ul className="mt-5 space-y-3">
            {rightItems.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-ink-1">
                <Check className="mt-0.5 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

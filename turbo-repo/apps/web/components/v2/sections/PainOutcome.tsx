import { getTranslations } from "next-intl/server";
import { Section, SectionHeader, Check, type Tone } from "./shared";

export async function PainOutcome({
  lang,
  tone,
}: {
  lang: string;
  tone: Tone;
}) {
  const t = await getTranslations({ locale: lang, namespace: "painOutcome" });
  const leftItems = t.raw("left.items") as string[];
  const rightItems = t.raw("right.items") as string[];
  return (
    <Section tone={tone}>
      <SectionHeader kicker={t("kicker")} title={t("title")} />
      <div className="border-hairline bg-surface order-2 mt-12 grid overflow-hidden rounded-[14px] border sm:grid-cols-2 lg:order-1 lg:col-span-2">
        <div className="p-7">
          <h3 className="text-ink-3 text-base font-semibold">
            {t("left.title")}
          </h3>
          <ul className="mt-5 space-y-3">
            {leftItems.map((item) => (
              <li
                key={item}
                className="text-ink-3 flex items-start gap-3 text-sm leading-relaxed"
              >
                <svg
                  className="text-ink-4 mt-0.5 h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-hairline bg-accent-soft sm:border-accent border-t p-7 sm:border-t-0 sm:border-l-2">
          <h3 className="text-ink-1 text-base font-semibold">
            {t("right.title")}
          </h3>
          <ul className="mt-5 space-y-3">
            {rightItems.map((item) => (
              <li
                key={item}
                className="text-ink-1 flex items-start gap-3 text-sm leading-relaxed"
              >
                <Check className="text-accent mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

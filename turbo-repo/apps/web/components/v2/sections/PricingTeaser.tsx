import { getTranslations } from "next-intl/server";
import { Section, Eyebrow } from "./shared";

export async function PricingTeaser({ base, lang }: { base: string; lang: string }) {
  const t = await getTranslations({ locale: lang, namespace: "pricingTeaser" });
  return (
    <Section tone="white">
      <div className="rounded-2xl border border-ink-1 bg-ink-1 p-10 text-center sm:p-14 dark:border-hairline dark:bg-surface">
        <Eyebrow>{t("kicker")}</Eyebrow>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-page sm:text-4xl dark:text-ink-1">
          {t("title")}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-page/70 dark:text-ink-2">{t("subtitle")}</p>
        <a
          href={`${base}/precios`}
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-white px-6 py-3.5 text-[15px] font-medium text-gray-950 transition-colors hover:bg-gray-100"
        >
          {t("cta")}
        </a>
      </div>
    </Section>
  );
}

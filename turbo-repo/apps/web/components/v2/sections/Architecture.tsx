import { getTranslations } from "next-intl/server";
import { Reveal } from "../Reveal";
import { Section, SectionHeader } from "./shared";

type ArchStep = { n: string; title: string; body: string };

export async function Architecture({ lang }: { lang: string }) {
  const t = await getTranslations({ locale: lang, namespace: "architecture" });
  const steps = t.raw("steps") as ArchStep[];
  return (
    <Section id="arquitectura" tone="gray">
      <SectionHeader kicker={t("kicker")} title={t("title")} subtitle={t("subtitle")} />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.12} className="relative rounded-[14px] border border-hairline bg-surface p-7">
            <span className="font-mono text-xs tracking-[0.12em] text-ink-4">{s.n}</span>
            <h3 className="mt-3 text-lg font-semibold tracking-[-0.01em] text-ink-1">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
            {i < steps.length - 1 && (
              <svg className="absolute top-1/2 -right-4 z-10 hidden h-5 w-5 -translate-y-1/2 text-ink-4 md:block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            )}
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-8 max-w-2xl rounded-[14px] border border-ink-1 bg-ink-1 p-8 dark:border-hairline dark:bg-surface">
        <p className="font-mono text-2xl font-medium text-page tabular-nums dark:text-ink-1">{t("latency")}</p>
        <p className="mt-2 text-sm text-page/60 dark:text-ink-3">{t("latencySubtitle")}</p>
      </Reveal>
    </Section>
  );
}

import { getTranslations } from "next-intl/server";
import { Reveal } from "../Reveal";
import { StatsGrid, type StatItem } from "../StatsGrid";
import { Section, SectionHeader } from "./shared";

type Case = { tag: string; before: string; after: string };
type Quote = { text: string; author: string };

export async function Stories({ lang }: { lang: string }) {
  const t = await getTranslations({ locale: lang, namespace: "stories" });
  const metrics = t.raw("metrics") as StatItem[];
  const cases = t.raw("cases") as Case[];
  const quotes = t.raw("quotes") as Quote[];
  return (
    <Section id="clientes" tone="white">
      <SectionHeader kicker={t("kicker")} title={t("title")} />
      <div className="mt-12 gap-6 rounded-[14px] border border-hairline bg-surface px-6 py-7">
        <StatsGrid items={metrics} size="md" wrapAt="sm" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {cases.map((cs, i) => (
          <Reveal key={cs.tag} delay={i * 0.1} className="rounded-[14px] border border-hairline bg-surface p-7">
            <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
              {t("caseLabel")} · {cs.tag}
            </span>
            <div className="mt-6 space-y-5">
              <div>
                <p className="font-mono text-[11px] tracking-[0.12em] text-ink-4 uppercase">{t("beforeLabel")}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">{cs.before}</p>
              </div>
              <div className="border-l-2 border-accent pl-4">
                <p className="font-mono text-[11px] tracking-[0.12em] text-accent uppercase">{t("afterLabel")}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-1">{cs.after}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {quotes.map((q, i) => (
          <Reveal key={q.author} delay={i * 0.1} as="div">
            <figure className="h-full rounded-[14px] border border-hairline bg-surface p-7">
              <blockquote className="text-lg leading-relaxed font-medium text-ink-1">“{q.text}”</blockquote>
              <figcaption className="mt-4 text-sm text-ink-3">— {q.author}</figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

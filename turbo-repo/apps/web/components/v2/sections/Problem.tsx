import { getTranslations } from "next-intl/server";
import { Reveal } from "../Reveal";
import { Section, SectionHeader, type Tone } from "./shared";

type Pain = { title: string; body: string };

export async function Problem({ lang, tone }: { lang: string; tone: Tone }) {
  const t = await getTranslations({ locale: lang, namespace: "problem" });
  const pains = t.raw("pains") as Pain[];
  return (
    <Section tone={tone}>
      <SectionHeader kicker={t("kicker")} title={t("title")} subtitle={t("subtitle")} />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {pains.map((p, i) => (
          <Reveal
            key={p.title}
            delay={i * 0.1}
            className="rounded-xl border border-hairline bg-surface p-6 transition-colors hover:border-hairline-strong"
          >
            <blockquote className="text-lg leading-snug font-semibold text-ink-1 italic">{p.title}</blockquote>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">{p.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

import { getTranslations } from "next-intl/server";
import { Reveal } from "../Reveal";
import { Section, SectionHeader, ArrowRight, type Tone } from "./shared";

type Acto = { n: string; tag: string; title: string; body: string; cta: string };

// Núcleo narrativo. Cada acto abre su módulo nativo en el sitio con datos reales.
// Los hrefs no son texto traducible, así que quedan en código, alineados por
// índice con el array "actos" del namespace tresActos en los JSON de i18n.
const HREFS = (base: string) => [`${base}/torre`, `${base}/superprofile`, `${base}/canales`];

export async function TresActos({ base, lang, tone }: { base: string; lang: string; tone: Tone }) {
  const t = await getTranslations({ locale: lang, namespace: "tresActos" });
  const actos = t.raw("actos") as Acto[];
  const hrefs = HREFS(base);
  return (
    <Section id="tesis" tone={tone}>
      <SectionHeader kicker={t("kicker")} title={t("title")} subtitle={t("subtitle")} />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {actos.map((a, i) => (
          <Reveal
            key={a.n}
            delay={i * 0.08}
            className="flex flex-col rounded-[14px] border border-hairline bg-surface p-6 transition-colors hover:border-hairline-strong"
          >
            <p className="font-mono text-[11px] tracking-[0.12em] text-accent uppercase">
              {a.n} · {a.tag}
            </p>
            <h3 className="mt-3 text-lg font-semibold tracking-[-0.01em] text-ink-1">{a.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">{a.body}</p>
            <a
              href={hrefs[i]}
              className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-strong"
            >
              {a.cta} <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

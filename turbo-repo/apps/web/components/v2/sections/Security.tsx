import { getTranslations } from "next-intl/server";
import { Reveal } from "../Reveal";
import { Section, SectionHeader, type Tone } from "./shared";
import type { Item } from "./Security.types";

// Seguridad & datos: la sección que de-riesga la decisión en la motion
// demo-led — dónde viven los datos, quién los trata y qué respaldo hay.
export async function Security({ lang, tone }: { lang: string; tone: Tone }) {
  const t = await getTranslations({ locale: lang, namespace: "security" });
  const items = t.raw("items") as Item[];
  return (
    <Section id="seguridad" tone={tone}>
      <SectionHeader
        kicker={t("kicker")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <Reveal
            key={it.title}
            delay={i * 0.06}
            className="border-hairline bg-surface rounded-xl border p-6"
          >
            <div className="bg-accent-soft text-accent mb-4 flex h-9 w-9 items-center justify-center rounded-lg">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.7}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <h3 className="text-ink-1 text-base font-semibold">{it.title}</h3>
            <p className="text-ink-2 mt-2 text-sm leading-relaxed">{it.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

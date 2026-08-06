import { getTranslations } from "next-intl/server";
import { StatsGrid, type StatItem } from "../StatsGrid";
import { Section, type Tone } from "./shared";

// Banda de validación: cifras de una operación real, en el trato del DS —
// tabulares, tinta sobre superficie alterna, sin banda oscura.
export async function Stats({ lang, tone }: { lang: string; tone: Tone }) {
  const t = await getTranslations({ locale: lang, namespace: "stats" });
  const items = t.raw("items") as StatItem[];
  return (
    <Section tone={tone} contentClassName="py-14">
      <StatsGrid items={items} cols={3} align="center" />
    </Section>
  );
}

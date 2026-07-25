import { getTranslations } from "next-intl/server";
import { StatsGrid, type StatItem } from "../StatsGrid";

// Banda de validación: cifras de una operación real, en el trato del DS —
// tabulares, tinta sobre superficie alterna, sin banda oscura.
export async function Stats({ lang }: { lang: string }) {
  const t = await getTranslations({ locale: lang, namespace: "stats" });
  const items = t.raw("items") as StatItem[];
  return (
    <section className="border-y border-hairline bg-page-alt">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <StatsGrid items={items} />
      </div>
    </section>
  );
}

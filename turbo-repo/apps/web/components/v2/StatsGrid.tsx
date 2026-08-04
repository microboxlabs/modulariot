import { Counter } from "./Counter";
import { Reveal } from "./Reveal";

export type StatItem = { prefix?: string; value: string; label: string };

// Grilla de estadísticas reutilizada por Stats (banda de validación),
// Stories (métricas de clientes) y DetailPage (bloque "stats" de páginas de
// producto). Cada caller conserva su propio wrapper (banda, tarjeta, panel
// oscuro); este componente solo resuelve el ítem prefix/valor animado/label.
export function StatsGrid({
  items,
  size = "lg",
  tone = "light",
  align = "left",
  wrapAt = "lg",
  cols = 4,
}: {
  items: StatItem[];
  size?: "md" | "lg";
  tone?: "light" | "dark";
  align?: "left" | "center";
  wrapAt?: "sm" | "lg";
  cols?: 3 | 4;
}) {
  const valueClass = tone === "dark" ? "text-page dark:text-ink-1" : "text-ink-1";
  const labelClass = tone === "dark" ? "text-page/60 dark:text-ink-3" : "text-ink-3";
  const valueSize = size === "lg" ? "text-4xl sm:text-5xl" : "text-3xl";
  const colsClass =
    cols === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : `grid-cols-2 ${wrapAt === "sm" ? "sm:grid-cols-4" : "lg:grid-cols-4"}`;

  return (
    <div className={`grid gap-x-8 gap-y-10 ${colsClass} ${align === "center" ? "text-center" : ""}`}>
      {items.map((s, i) => (
        <Reveal key={s.label} delay={i * 0.06}>
          {s.prefix && <p className="text-sm text-ink-3">{s.prefix}</p>}
          <p className={`display tabular-nums ${s.prefix ? "mt-1" : ""} ${valueSize} ${valueClass}`}>
            <Counter value={s.value} />
          </p>
          <p className={`mt-2 text-xs font-medium tracking-[0.08em] uppercase ${labelClass}`}>{s.label}</p>
        </Reveal>
      ))}
    </div>
  );
}

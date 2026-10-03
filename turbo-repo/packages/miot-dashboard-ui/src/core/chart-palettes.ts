export type ChartColorPalette =
  | "default"
  | "cool"
  | "warm"
  | "monochrome"
  | "pastel"
  | "vivid"
  | "custom";

const BUILTIN_PALETTES: Record<
  Exclude<ChartColorPalette, "custom">,
  string[]
> = {
  default: [
    "#5470c6",
    "#91cc75",
    "#fac858",
    "#ee6666",
    "#73c0de",
    "#3ba272",
    "#fc8452",
    "#9a60b4",
    "#ea7ccc",
  ],
  cool: ["#3b82f6", "#06b6d4", "#8b5cf6", "#6366f1", "#14b8a6", "#0ea5e9"],
  warm: ["#ef4444", "#f97316", "#eab308", "#f59e0b", "#dc2626", "#ea580c"],
  monochrome: [
    "#1f2937",
    "#374151",
    "#4b5563",
    "#6b7280",
    "#9ca3af",
    "#d1d5db",
  ],
  pastel: ["#93c5fd", "#86efac", "#fde68a", "#fca5a5", "#c4b5fd", "#fbcfe8"],
  vivid: ["#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#9333ea", "#0891b2"],
};

/** Read-only catalog; each dashboard receives its own mutable copy through getChartColors. */
export const CHART_COLOR_PALETTES: Readonly<
  Record<Exclude<ChartColorPalette, "custom">, readonly string[]>
> = Object.freeze(
  Object.fromEntries(
    Object.entries(BUILTIN_PALETTES).map(([key, colors]) => [
      key,
      Object.freeze(colors),
    ]),
  ) as Record<Exclude<ChartColorPalette, "custom">, readonly string[]>,
);

export function getChartColors(
  palette: ChartColorPalette,
  customColors: readonly string[] = [],
): string[] {
  if (palette === "custom" && customColors.length > 0) return [...customColors];
  if (palette !== "custom" && Object.hasOwn(CHART_COLOR_PALETTES, palette)) {
    return [...CHART_COLOR_PALETTES[palette]];
  }
  return [...CHART_COLOR_PALETTES.default];
}

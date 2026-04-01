export type ColorPalette =
  | "default"
  | "cool"
  | "warm"
  | "monochrome"
  | "pastel"
  | "vivid"
  | "custom";

export const COLOR_PALETTES: Record<Exclude<ColorPalette, "custom">, string[]> =
  {
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
    pastel: [
      "#93c5fd",
      "#86efac",
      "#fde68a",
      "#fca5a5",
      "#c4b5fd",
      "#fbcfe8",
    ],
    vivid: ["#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#9333ea", "#0891b2"],
  };

export function getColors(
  palette: ColorPalette,
  customColors: string[],
): string[] {
  if (palette === "custom" && customColors.length > 0) return customColors;
  return COLOR_PALETTES[palette as Exclude<ColorPalette, "custom">] ?? COLOR_PALETTES.default;
}

"use client";

import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";

function hexSinHash(color: string): string {
  return color.replace(/^#/, "");
}

export default function GeofenceColorPicker({
  color,
  onChange,
  title = "Color de la geocerca",
}: Readonly<{
  color: string;
  onChange?: (color: string) => void;
  title?: string;
}>) {
  if (!onChange) {
    return (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-gray-200 dark:ring-gray-600"
        style={{ background: color }}
        aria-hidden
      />
    );
  }
  const elegir = (hex: string) => onChange(`#${hex}`);
  return (
    <AdvancedColorPicker
      value={hexSinHash(color)}
      onChange={elegir}
      title={title}
      className="!h-9 !w-9 !min-h-9 !min-w-9 !p-0 !px-0 !py-0 shrink-0 aspect-square"
    />
  );
}

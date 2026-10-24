"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";

export type CatalogLayout = "cards" | "list";

/** Tarjetas / Lista, like the symptom catalog's. */
export default function LayoutToggle({
  layout,
  d,
  onLayout,
}: Readonly<{
  layout: CatalogLayout;
  d: I18nRecord;
  onLayout: (layout: CatalogLayout) => void;
}>) {
  return (
    <div className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
      {(["cards", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={layout === v}
          onClick={() => onLayout(v)}
          className={`rounded-md px-2.5 py-1 text-xs ${
            layout === v
              ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-white"
              : MUTED
          }`}
        >
          {v === "cards" ? tr("viewCards", d) : tr("viewList", d)}
        </button>
      ))}
    </div>
  );
}

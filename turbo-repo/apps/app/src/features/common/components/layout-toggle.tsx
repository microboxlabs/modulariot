"use client";

export type CatalogLayout = "cards" | "list";

/** Tarjetas / Lista for a settings catalog (síntomas, reglas, credenciales…); as tall as a small Button beside it. */
export default function LayoutToggle({
  layout,
  labels,
  onLayout,
}: Readonly<{
  layout: CatalogLayout;
  labels: Readonly<Record<CatalogLayout, string>>;
  onLayout: (layout: CatalogLayout) => void;
}>) {
  return (
    <div className="flex h-9 shrink-0 rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
      {(["cards", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={layout === v}
          onClick={() => onLayout(v)}
          className={`rounded-md px-2.5 text-xs ${
            layout === v
              ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-white"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}

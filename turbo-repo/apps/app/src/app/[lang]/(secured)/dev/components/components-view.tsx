"use client";

import { getAllDashlets } from "@/features/dashboard/dashlets";
import type { DashletDefinition } from "@/features/dashboard/dashlets";
import { resolveDashletPreview } from "@/features/dashboard/dashlets/dashlet-preview";
import { DEFAULT_HARNESS_EXTENSIONS } from "@/features/harness-chat/extensions";
import type { HarnessExtension } from "@/features/harness-chat/harness-extension";
import {
  ExtensionVariantPreview,
  getExtensionVariants,
  type ExtensionVariant,
} from "./extension-preview";

function ExtensionCard({
  extension,
  variant,
}: Readonly<{ extension: HarnessExtension; variant: ExtensionVariant }>) {
  return (
    <section
      id={variant.id}
      className="scroll-mt-6 flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex shrink-0 items-baseline gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {variant.label}
        </h2>
      </div>
      <div className="flex flex-1 items-center justify-center bg-gray-50 p-5 dark:bg-gray-900/40">
        <ExtensionVariantPreview extension={extension} variant={variant} />
      </div>
    </section>
  );
}

function DashletCard({ dashlet }: Readonly<{ dashlet: DashletDefinition }>) {
  const resolved = resolveDashletPreview(dashlet.meta.id);
  if (resolved.status !== "ok") return null;

  return (
    <section
      id={dashlet.meta.id}
      className="scroll-mt-6 flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex shrink-0 items-baseline gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {dashlet.meta.name}
        </h2>
        <code className="text-xs text-gray-400 dark:text-gray-500">
          {dashlet.meta.id}
        </code>
      </div>
      <div className="flex flex-1 items-center justify-center bg-gray-50 p-5 dark:bg-gray-900/40">
        <div
          className="w-full max-w-md overflow-hidden rounded-lg"
          style={{ height: resolved.heightPx }}
        >
          <resolved.Component widget={resolved.widget} editMode={false} />
        </div>
      </div>
    </section>
  );
}

function SectionNav({
  items,
}: Readonly<{ items: { id: string; label: string }[] }>) {
  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function ComponentsView() {
  // Every (extension, variant) pair with a sample-args entry to render with
  // — ask_user_question has one per shape (single/multi-select); show_dashlet
  // has none, see extension-preview.tsx.
  const extensionVariants = DEFAULT_HARNESS_EXTENSIONS.flatMap((extension) =>
    getExtensionVariants(extension).map((variant) => ({ extension, variant })),
  );

  // Only dashlets show_dashlet can actually render in chat — showInChat:
  // false dashlets aren't accessible from chat at all, so they don't belong
  // in a gallery of what chat can show.
  const dashlets = getAllDashlets()
    .filter((d) => d.showInChat !== false)
    .sort((a, b) => a.meta.name.localeCompare(b.meta.name));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Chat components
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Everything the chat panel can render, live — extension cards (e.g.
          ask_user_question, in every shape it supports) and every dashlet
          show_dashlet can show, standalone with its own defaultConfig.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Extension components
        </h2>
        <SectionNav
          items={extensionVariants.map(({ variant }) => ({
            id: variant.id,
            label: variant.label,
          }))}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {extensionVariants.map(({ extension, variant }) => (
            <ExtensionCard key={variant.id} extension={extension} variant={variant} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Dashlet components
        </h2>
        <SectionNav
          items={dashlets.map((d) => ({ id: d.meta.id, label: d.meta.id }))}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {dashlets.map((dashlet) => (
            <DashletCard key={dashlet.meta.id} dashlet={dashlet} />
          ))}
        </div>
      </div>
    </div>
  );
}

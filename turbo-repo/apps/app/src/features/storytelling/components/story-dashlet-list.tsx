"use client";

import { getAllDashlets, type DashletDefinition } from "@/features/dashboard/dashlets";
import { resolveDashletPreview } from "@/features/dashboard/dashlets/dashlet-preview";

/**
 * "Whatever we define" for a story's big screen, for now: every dashlet the
 * dashboard has, standalone with its own defaultConfig — the same renderer
 * /dev/components uses for its gallery (resolveDashletPreview) — stacked as
 * one column of components directly, not boxed cards in a grid.
 */
export default function StoryDashletList() {
  const dashlets = getAllDashlets()
    .filter((d) => d.showInChat !== false)
    .sort((a, b) => a.meta.name.localeCompare(b.meta.name));

  return (
    <div className="flex flex-col gap-6">
      {dashlets.map((dashlet) => (
        <DashletRow key={dashlet.meta.id} dashlet={dashlet} />
      ))}
    </div>
  );
}

function DashletRow({ dashlet }: { readonly dashlet: DashletDefinition }) {
  const resolved = resolveDashletPreview(dashlet.meta.id);
  if (resolved.status !== "ok") return null;

  // No border/background/padding — just the pixel height the dashlet itself
  // asks for (same formula resolveDashletPreview and the real dashboard grid
  // both use), so it renders correctly without being wrapped in a box.
  return (
    <div style={{ height: resolved.heightPx }}>
      <resolved.Component widget={resolved.widget} editMode={false} />
    </div>
  );
}

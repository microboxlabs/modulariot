import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The whole `/storytelling` segment is testing-only for now, gated on
 * `ENABLE_STORYTELLING` (see runtime-config.types.ts; the nav entry is hidden
 * by features/layout/models/pages.ts). Hiding the nav link doesn't stop
 * direct URL / bookmark / deep-link access, so the segment fails closed here
 * — once, ahead of both the list page and the `[id]` detail route, instead
 * of each page repeating the check.
 */
export default function StorytellingLayout({ children }: { readonly children: ReactNode }) {
  if (process.env.ENABLE_STORYTELLING !== "true") {
    notFound();
  }

  return children;
}

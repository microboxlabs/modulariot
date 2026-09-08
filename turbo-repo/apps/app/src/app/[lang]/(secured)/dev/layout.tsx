import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The `/dev` segment is reference-only tooling (extension/component
 * galleries for whoever builds harness-chat integrations), gated on
 * `ENABLE_DEV_TOOLS` (see runtime-config.types.ts; the nav entry is hidden
 * by features/layout/models/pages.ts). Hiding the nav link doesn't stop
 * direct URL access, so the segment fails closed here — once, ahead of every
 * page under it, instead of each page repeating the check.
 */
export default function DevLayout({ children }: { readonly children: ReactNode }) {
  if (process.env.ENABLE_DEV_TOOLS !== "true") {
    notFound();
  }

  return children;
}

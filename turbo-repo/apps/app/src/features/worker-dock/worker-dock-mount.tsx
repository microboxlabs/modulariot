"use client";

import dynamic from "next/dynamic";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { WorkerDock } from "./worker-dock";

// The WebGL canvas is browser-only — never server-render it. It's a fixed,
// click-through overlay, so where it sits in the DOM doesn't matter.
const OrbCanvas = dynamic(() => import("./orb-canvas"), { ssr: false });

/**
 * Rendered as a sibling of the harness chat panel (see `harness-chat-mount.tsx`),
 * so the dock lands as the last flex child of the layout `<main>` — immediately
 * to the right of the chat panel. Kiosk mode is already handled one level up.
 */
export function WorkerDockMount({ dict }: Readonly<{ dict: I18nRecord }>) {
  return (
    <>
      <OrbCanvas />
      <WorkerDock dict={dict} />
    </>
  );
}

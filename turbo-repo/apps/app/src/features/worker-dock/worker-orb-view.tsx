"use client";

import { forwardRef } from "react";
import { View } from "@react-three/drei";
import { twMerge } from "tailwind-merge";
import { Orb, type OrbMode } from "./orb";

/**
 * A DOM box that a slice of the shared orb canvas is scissored into (see
 * `orb-canvas.tsx` for the single `<Canvas>` + `<View.Port />`). Drop it
 * wherever a worker's face should appear — the dock buttons, the chat header,
 * the assistant avatar. `color` is a raw hex (from `worker-colors.ts`).
 *
 * No background: the scissor rect *is* the clip, so when the orb sinks (exit)
 * or hasn't risen yet (entrance) there's simply nothing there — it reads as the
 * character being behind the screen.
 */
export const WorkerOrbView = forwardRef<
  HTMLDivElement,
  Readonly<{
    color: string;
    mode: OrbMode;
    entrance?: boolean;
    entranceDelayMs?: number;
    className?: string;
  }>
>(function WorkerOrbView({ color, mode, entrance, entranceDelayMs, className }, ref) {
  return (
    <View ref={ref} className={twMerge("relative shrink-0", className)}>
      <Orb
        color={color}
        mode={mode}
        entrance={entrance}
        entranceDelayMs={entranceDelayMs}
      />
    </View>
  );
});

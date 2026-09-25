/**
 * PROTOTYPE — clusters a symptom's flat `treatments` array into "treatment
 * episodes": e.g. a call plus an escalation attempted together read as one
 * episode, a later missed call plus a follow-up call read as another. The
 * real `TreatmentTimelineElement` (see `types/timeline.ts`) has no episode
 * id and no per-treatment timestamp to group or order by, so both the
 * cluster boundaries and each episode's mock time are derived from a stable
 * hash of the symptom — frontend-only, same as `mock-call-log.ts`.
 */

import type { TreatmentTimelineElement } from "@/features/symptoms/types/timeline";
import { hashId } from "./mock-contact-data";

export interface TreatmentGroup {
  id: string;
  time: Date | null;
  items: { treatment: TreatmentTimelineElement; index: number }[];
}

export function groupTreatments(
  treatments: TreatmentTimelineElement[],
  seed: string,
  start?: string | null,
  end?: string | null
): TreatmentGroup[] {
  const startMs = start ? new Date(start).getTime() : null;

  // First pass: 1-2 procedures per episode, deterministic per position.
  const sizes: number[] = [];
  let consumed = 0;
  while (consumed < treatments.length) {
    const size = 1 + (hashId(`${seed}:group:${sizes.length}`) % 2);
    sizes.push(Math.min(size, treatments.length - consumed));
    consumed += size;
  }

  const endMs = end ? new Date(end).getTime() : null;
  const span =
    startMs !== null && endMs !== null && endMs > startMs ? endMs - startMs : null;

  let offset = 0;
  return sizes.map((size, groupIndex) => {
    const items = treatments
      .slice(offset, offset + size)
      .map((treatment, i) => ({ treatment, index: offset + i }));
    offset += size;

    let time: Date | null = null;
    if (startMs !== null) {
      time =
        span !== null
          ? new Date(startMs + (span * groupIndex) / Math.max(sizes.length - 1, 1))
          : new Date(startMs + groupIndex * 4 * 60_000);
    }

    return { id: `${seed}-g${groupIndex}`, time, items };
  });
}

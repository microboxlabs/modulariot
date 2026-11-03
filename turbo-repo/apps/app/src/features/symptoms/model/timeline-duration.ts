import type { TimelineElement } from "../types/timeline";
import { isEngineCaseId } from "./treatment-link";

/** Engine steps share one case interval; legacy groups keep their longest condition. */
export function timelineDurationMinutes(item: TimelineElement): number {
  if (isEngineCaseId(item.symptom_id)) {
    return Math.max(
      0,
      Math.floor(
        (new Date(item.end).getTime() - new Date(item.start).getTime()) / 60000
      )
    );
  }
  return (
    item.conditions_agg?.reduce(
      (max, condition) =>
        Math.max(
          max,
          Math.floor(
            (new Date(condition.end).getTime() -
              new Date(condition.start).getTime()) /
              60000
          )
        ),
      0
    ) ?? 0
  );
}

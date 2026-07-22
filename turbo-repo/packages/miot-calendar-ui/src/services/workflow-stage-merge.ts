import type { PlannedService } from "../types/planning";

/**
 * Overlay the host's live workflow stage onto planned services (read-time
 * join). The resolver's answer wins; undefined preserves any load-time
 * `workflowStage` (e.g. a terminal state read from the booking payload).
 *
 * Identity-preserving: items whose effective stage is unchanged are returned
 * as-is, and with no resolver the input array itself is returned, so
 * downstream memos keyed on references stay stable.
 */
export function mergeWorkflowStages<TItem extends { id: string }>(
  planned: PlannedService<TItem>[],
  resolve?: (item: TItem) => string | undefined
): PlannedService<TItem>[] {
  if (!resolve) return planned;
  let changed = false;
  const merged = planned.map((ps) => {
    const stage = resolve(ps.service) ?? ps.workflowStage;
    if (stage === ps.workflowStage) return ps;
    changed = true;
    return { ...ps, workflowStage: stage };
  });
  return changed ? merged : planned;
}

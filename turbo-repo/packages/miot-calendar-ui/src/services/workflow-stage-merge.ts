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

/**
 * Overlay host-resolved fields onto each planned item (read-time join, same
 * posture as {@link mergeWorkflowStages}). Only keys whose value actually
 * differs are applied, so an item the resolver has nothing new for is
 * returned as-is and downstream memos keyed on references stay stable.
 */
export function mergeItemOverlays<TItem extends { id: string }>(
  planned: PlannedService<TItem>[],
  resolve?: (item: TItem) => Partial<TItem> | undefined
): PlannedService<TItem>[] {
  if (!resolve) return planned;
  let changed = false;
  const merged = planned.map((ps) => {
    const overlay = resolve(ps.service);
    if (!overlay) return ps;
    const keys = (Object.keys(overlay) as (keyof TItem)[]).filter(
      (key) => overlay[key] !== undefined && overlay[key] !== ps.service[key]
    );
    if (keys.length === 0) return ps;
    changed = true;
    const service = { ...ps.service };
    for (const key of keys) service[key] = overlay[key] as TItem[typeof key];
    return { ...ps, service };
  });
  return changed ? merged : planned;
}

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
    const service = applyItemOverlay(ps.service, resolve(ps.service));
    if (service === ps.service) return ps;
    changed = true;
    return { ...ps, service };
  });
  return changed ? merged : planned;
}

/**
 * Apply a resolved overlay to one item: only keys whose value is defined and
 * actually differs are written, and an item with nothing to change is returned
 * by reference.
 *
 * Deliberately narrow. The overlay names the fields the host's live index owns
 * and nothing else, so applying it can never substitute one item for another —
 * host item ids are not guaranteed unique across the lists a host draws from,
 * and swapping the object wholesale would silently replace a caller's item
 * with a same-id item loaded from somewhere else.
 */
export function applyItemOverlay<TItem>(
  item: TItem,
  overlay: Partial<TItem> | undefined
): TItem {
  if (!overlay) return item;
  const keys = (Object.keys(overlay) as (keyof TItem)[]).filter(
    (key) => overlay[key] !== undefined && overlay[key] !== item[key]
  );
  if (keys.length === 0) return item;
  const next = { ...item };
  for (const key of keys) next[key] = overlay[key] as TItem[typeof key];
  return next;
}

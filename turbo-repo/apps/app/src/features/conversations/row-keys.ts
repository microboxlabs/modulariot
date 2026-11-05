"use client";

import { useState } from "react";

/**
 * React keys for rows that have no id of their own (steps, audience
 * entries): each row keeps one, moved and removed with it.
 */
export function useRowKeys(length: number) {
  const [ids, setIds] = useState(() =>
    Array.from({ length }, () => crypto.randomUUID())
  );
  let keys = ids;
  if (ids.length !== length) {
    // Rows added, or the list replaced from outside: keep the ids that still have a row.
    keys = Array.from({ length }, (_, i) => ids[i] ?? crypto.randomUUID());
    setIds(keys);
  }
  return {
    keys,
    move: (i: number, by: number) => {
      const next = [...keys];
      const [id] = next.splice(i, 1);
      next.splice(i + by, 0, id);
      setIds(next);
    },
    remove: (i: number) => setIds(keys.filter((_, j) => j !== i)),
  };
}

/** `list` with the item at `i` moved `by` places. */
export function moved<T>(list: T[], i: number, by: number): T[] {
  const next = [...list];
  const [item] = next.splice(i, 1);
  next.splice(i + by, 0, item);
  return next;
}

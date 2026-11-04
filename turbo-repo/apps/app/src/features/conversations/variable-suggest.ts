/**
 * Completing a `{{variable}}` as it is typed: after `{{`, the variables whose
 * name or label match what follows are offered, and picking one writes the
 * whole `{{name}}`.
 */

import type { EventField } from "./conversations-types";

/** An open `{{` before the caret: where it starts and what was typed after it. */
export interface OpenVariable {
  from: number;
  query: string;
}

const OPEN = /\{\{\s*(\w*)$/;

/** The `{{…` the caret is in, or null when it is not inside one. */
export function openVariable(text: string, caret: number): OpenVariable | null {
  const m = OPEN.exec(text.slice(0, caret));
  if (!m) return null;
  return { from: caret - m[0].length, query: m[1] ?? "" };
}

/** Names that start with the query first, then labels that contain it. */
export function matchingVariables(
  variables: readonly EventField[],
  query: string
): EventField[] {
  const q = query.toLowerCase();
  if (!q) return [...variables];
  const byName = variables.filter((v) => v.name.toLowerCase().startsWith(q));
  const byLabel = variables.filter(
    (v) => !byName.includes(v) && v.label.toLowerCase().includes(q)
  );
  return [...byName, ...byLabel];
}

/** The text with `{{name}}` in place of the open `{{…`, and the caret after it; an existing `}}` is reused. */
export function completeVariable(
  text: string,
  open: OpenVariable,
  caret: number,
  name: string
): { value: string; caret: number } {
  let rest = text.slice(caret);
  const closing = /^\w*\s*\}\}/.exec(rest);
  if (closing) rest = rest.slice(closing[0].length);
  const inserted = `{{${name}}}`;
  return {
    value: text.slice(0, open.from) + inserted + rest,
    caret: open.from + inserted.length,
  };
}

"use client";

import { useMemo, useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { inList, OBJECTS } from "./condition-form";
import type { DataSource, SourceField } from "./maintainer-api";
import SampleTree, {
  fieldInfos,
  type InsertText,
  type ListMembers,
  unsupportedPaths,
} from "./sample-tree";
import { Panel } from "./symptom-side-panels";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** What clicking a field writes: its path, or for a list a condition on its elements to fill in. */
export function fieldText(f: SourceField): string {
  return f.type === OBJECTS
    ? `${f.path}.exists(e, e.event_type == "")`
    : f.path;
}

/**
 * The sample with every field of the source in it, so fields the sample lacks
 * still show; they have no value. A list's own fields stay out: they show
 * under the list.
 */
export function withAllFields(
  sample: Json | undefined,
  fields: readonly SourceField[]
): Json {
  const out: Json = structuredClone(sample ?? {});
  for (const f of fields) {
    if (inList(f.path, [...fields])) continue;
    const keys = f.path.split(".");
    let at: Json = out;
    for (const key of keys.slice(0, -1)) {
      const value = at[key];
      const next = isObject(value) ? value : {};
      at[key] = next;
      at = next;
    }
    const last = keys.at(-1) as string;
    if (!(last in at)) at[last] = undefined;
  }
  return out;
}

/** The fields of each list's elements, by the list's path. */
export function listMembers(fields: readonly SourceField[]): ListMembers {
  const lists = fields.filter((f) => f.type === OBJECTS);
  return new Map(
    lists.map((l) => [
      l.path,
      fields.filter((f) => f.path.startsWith(`${l.path}.`)).map((f) => f.path),
    ])
  );
}

/**
 * The source's fields as the signal fields tree: filter, meaning, unit,
 * origin and a sample value. Clicking or dragging one inserts it in the rule
 * edited last; a list inserts a condition on its elements.
 */
export function FieldsPanel({
  source,
  d,
}: Readonly<{ source: DataSource | undefined; d: I18nRecord }>) {
  const [index, setIndex] = useState(0);
  const fields = useMemo(() => source?.fields ?? [], [source]);
  const infos = useMemo(() => fieldInfos(fields, d), [fields, d]);
  const notInEngine = useMemo(() => unsupportedPaths(fields), [fields]);
  const members = useMemo(() => listMembers(fields), [fields]);
  const samples = useMemo(() => {
    const given = source?.samples ?? [];
    return (given.length > 0 ? given : [undefined]).map((s) =>
      withAllFields(s, fields)
    );
  }, [source, fields]);
  const insertText = useMemo<InsertText>(() => {
    const byPath = new Map(fields.map((f) => [f.path, f]));
    return (path) => {
      const f = byPath.get(path);
      const text = f ? fieldText(f) : path;
      return {
        text,
        caret: f?.type === OBJECTS ? text.length - 2 : text.length,
      };
    };
  }, [fields]);
  const shown = Math.min(index, samples.length - 1);
  return (
    <Panel
      title={
        source ? tr("fieldsOf", d, { source: source.name }) : tr("fields", d)
      }
    >
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        {tr("fieldsHint", d)}
      </p>
      {fields.length > 0 && (
        <SampleTree
          samples={samples}
          index={shown}
          notInEngine={notInEngine}
          fields={infos}
          members={members}
          insertText={insertText}
          layout="panel"
          readOnly={false}
          d={d}
          onIndex={setIndex}
        />
      )}
    </Panel>
  );
}

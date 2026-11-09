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

function ownValue(value: unknown, key: string): unknown {
  return isObject(value) && Object.hasOwn(value, key) ? value[key] : undefined;
}

/** Treat every catalog segment as data, including __proto__ and constructor. */
function setOwn(target: Json, key: string, value: unknown) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/** What clicking a field writes: its path, or for a list a condition on its elements to fill in. */
export function fieldText(f: SourceField): string {
  return f.type === OBJECTS
    ? `${f.path}.exists(e, e.event_type == "")`
    : f.path;
}

/**
 * Every catalog field, with its sample value when present. Sample-only paths
 * stay out, and missing fields still show without a value. A list's own fields
 * show under the list instead of as insertable paths.
 */
export function withAllFields(
  sample: Json | undefined,
  fields: readonly SourceField[]
): Json {
  const out: Json = {};
  for (const f of fields) {
    if (inList(f.path, [...fields])) continue;
    const keys = f.path.split(".");
    let at: Json = out;
    let value: unknown = sample;
    for (const key of keys.slice(0, -1)) {
      const child = ownValue(at, key);
      const next = isObject(child) ? child : {};
      setOwn(at, key, next);
      at = next;
      value = ownValue(value, key);
    }
    const last = keys.at(-1) as string;
    setOwn(at, last, structuredClone(ownValue(value, last)));
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

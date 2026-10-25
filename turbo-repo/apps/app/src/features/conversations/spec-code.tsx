"use client";

import { useMemo, useState } from "react";
import JsonCodeEditor, {
  jsonIssues,
  jsonItemAt,
  type JsonKeys,
  type JsonType,
  type JsonValues,
} from "@/features/common/components/json-code-editor";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { FieldError } from "@/features/symptoms/maintainer/ui/response-block";
import type { EditMode } from "@/features/symptoms/maintainer/level-row";
import ModeToggle from "@/features/symptoms/maintainer/ui/mode-toggle";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function matchesField(value: unknown, type: JsonType, name: string): boolean {
  if (name === "name" && value === null) return true;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isObject(value);
  return typeof value === type;
}

function validEntry(entry: unknown, keys: JsonKeys): boolean {
  if (!isObject(entry)) return false;
  return Object.entries(entry).every(([name, value]) => {
    const field = keys.objects.entries?.find((key) => key.label === name);
    return !field || matchesField(value, field.type, name);
  });
}

function validItem(item: Record<string, unknown>, keys: JsonKeys): boolean {
  if (
    keys.objects.entries &&
    (typeof item.id !== "string" || !Array.isArray(item.entries))
  )
    return false;
  return Object.entries(item).every(([name, value]) => {
    const field = keys.objects[""]?.find((key) => key.label === name);
    if (!field) return true;
    if (name === "entries")
      return (
        Array.isArray(value) && value.every((entry) => validEntry(entry, keys))
      );
    if (name === "to")
      return (
        Array.isArray(value) && value.every((id) => typeof id === "string")
      );
    return matchesField(value, field.type, name);
  });
}

/** Check the fields that the form reads before replacing its current, safe spec. */
export function isObjectList(
  data: unknown,
  keys?: JsonKeys
): data is Record<string, unknown>[] {
  if (!Array.isArray(data) || !data.every(isObject)) return false;
  if (!keys) return true;
  return data.every((item) => validItem(item, keys));
}

/** ☰ form / { } JSON for one section; JSON with an error keeps the section in code until it is fixed. */
export function CodeToggle({
  mode,
  broken,
  d,
  onChange,
}: Readonly<{
  mode: EditMode;
  broken: boolean;
  d: I18nRecord;
  onChange: (mode: EditMode) => void;
}>) {
  const texts = { ...d, exprMode: tr("jsonMode", d) };
  return (
    <ModeToggle
      mode={mode}
      d={texts}
      onChange={(m) => {
        if (m === "form" && broken) return;
        onChange(m);
      }}
    />
  );
}

/**
 * A section's part of the spec as JSON. Each edit that parses as a list of objects goes to `onChange`;
 * anything else is shown as an error and kept out of the rule.
 */
export default function SpecCode<T>({
  value,
  values,
  keys,
  itemLabel,
  normalize,
  messages,
  readOnly,
  label,
  d,
  onChange,
  onBroken,
}: Readonly<{
  value: T[];
  values: Record<string, JsonValues>;
  keys: JsonKeys;
  /** How a problem names the item it is in: "Paso 2". */
  itemLabel: (index: number) => string;
  /** The list with every part present, as the rule keeps it. */
  normalize: (list: Record<string, unknown>[]) => T[];
  /** The validator's findings for this section. */
  messages: string[];
  readOnly: boolean;
  label: string;
  d: I18nRecord;
  onChange: (value: T[]) => void;
  onBroken: (broken: boolean) => void;
}>) {
  const [shapeError, setShapeError] = useState<string | null>(null);
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const issues = useMemo(
    () => [
      ...new Set(
        jsonIssues(text, values, keys).map(
          (i) => `${itemLabel(jsonItemAt(text, i.from))}: ${i.message}`
        )
      ),
    ],
    [text, values, keys, itemLabel]
  );
  return (
    <div className="flex flex-col gap-1.5">
      <JsonCodeEditor
        value={value}
        values={values}
        keys={keys}
        readOnly={readOnly}
        ariaLabel={label}
        parseError={tr("jsonInvalid", d)}
        normalize={(data) =>
          isObjectList(data, keys) ? normalize(data) : data
        }
        onChange={(data, edited) => {
          setText(edited);
          if (data === null) {
            onBroken(true);
            setShapeError(null);
            return;
          }
          if (!isObjectList(data, keys)) {
            onBroken(true);
            setShapeError(tr("jsonInvalidShape", d));
            return;
          }
          onBroken(false);
          setShapeError(null);
          onChange(data as T[]);
        }}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("jsonHint", d)}
      </p>
      <FieldError text={shapeError ?? undefined} />
      {issues.map((m) => (
        <FieldError key={m} text={m} />
      ))}
      {messages.map((m) => (
        <FieldError key={m} text={m} />
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import JsonCodeEditor, {
  type JsonValues,
} from "@/features/common/components/json-code-editor";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { FieldError } from "@/features/symptoms/maintainer/ui/response-block";
import type { EditMode } from "@/features/symptoms/maintainer/level-row";
import ModeToggle from "@/features/symptoms/maintainer/ui/mode-toggle";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Whether `data` is a list of objects, the shape both groups and steps have. */
export function isObjectList(data: unknown): data is Record<string, unknown>[] {
  return Array.isArray(data) && data.every(isObject);
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
  return (
    <div className="flex flex-col gap-1.5">
      <JsonCodeEditor
        value={value}
        values={values}
        readOnly={readOnly}
        ariaLabel={label}
        parseError={tr("jsonInvalid", d)}
        normalize={(data) => (isObjectList(data) ? normalize(data) : data)}
        onChange={(data) => {
          if (data === null) {
            onBroken(true);
            setShapeError(null);
            return;
          }
          if (!isObjectList(data)) {
            onBroken(true);
            setShapeError(tr("jsonNotAList", d));
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
      {messages.map((m) => (
        <FieldError key={m} text={m} />
      ))}
    </div>
  );
}

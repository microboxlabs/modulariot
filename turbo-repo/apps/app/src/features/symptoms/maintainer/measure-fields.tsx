"use client";

import { useState } from "react";
import { HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { NumberValue } from "./activation-form";
import FieldCombobox from "./field-combobox";
import type { SourceField, SymptomSpec } from "./maintainer-api";
import {
  measureFields,
  measureFromForm,
  parseMeasure,
  type MeasureForm,
  type Minus,
} from "./measure-form";
import Select from "./ui/select";

type Measure = NonNullable<SymptomSpec["measure"]>;

const inputClass =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-900 dark:text-white";
const linkClass =
  "text-sm text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400";

/**
 * "Medida" in form mode: a numeric field, optionally minus another field or a
 * number. Its name comes from the fields. Other expressions are shown and
 * edited under { }.
 */
export default function MeasureFields({
  measure,
  fields,
  readOnly,
  levelsUseMeasure = false,
  d,
  onChange,
  onEditAsExpression,
}: Readonly<{
  measure: Measure | null | undefined;
  fields: SourceField[];
  readOnly: boolean;
  /** A level still compares the measure, so removing it has work to do. */
  levelsUseMeasure?: boolean;
  d: I18nRecord;
  onChange: (measure: Measure | null) => void;
  onEditAsExpression: () => void;
}>) {
  const expression = measure?.expression ?? null;
  const numeric = measureFields(fields);
  const form = expression ? parseMeasure(expression, fields) : null;

  if (expression && !form) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        {measure?.label && <b>{measure.label}</b>}
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">
          {expression}
        </code>
        <button
          type="button"
          className={linkClass}
          onClick={onEditAsExpression}
        >
          {tr("editAsExpression", d)}
        </button>
      </span>
    );
  }

  const set = (next: MeasureForm) =>
    onChange(measureFromForm(next, measure, fields));
  const removable = !readOnly && (form !== null || levelsUseMeasure);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <FieldCombobox
          value={form?.field ?? ""}
          fields={numeric}
          readOnly={readOnly}
          d={d}
          onChange={(f) => set({ field: f.path, minus: form?.minus ?? null })}
        />
        {form && (
          <MinusInputs
            form={form}
            numeric={numeric}
            readOnly={readOnly}
            d={d}
            onChange={set}
          />
        )}
        {form && measure?.unit && (
          <span className="text-gray-500 dark:text-gray-400">
            {measure.unit}
          </span>
        )}
        {removable && (
          <button
            type="button"
            className={linkClass}
            onClick={() => onChange(null)}
          >
            {tr("measureRemove", d)}
          </button>
        )}
      </div>
      {!form && (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noMeasure", d)}
        </span>
      )}
    </div>
  );
}

function MinusInputs({
  form,
  numeric,
  readOnly,
  d,
  onChange,
}: Readonly<{
  form: MeasureForm;
  numeric: SourceField[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (form: MeasureForm) => void;
}>) {
  const { minus } = form;
  // A field to subtract is written only once it is picked; until then the choice is local.
  const [pickingField, setPickingField] = useState(false);
  const kind: Minus["kind"] =
    minus?.kind === "field" || pickingField ? "field" : "number";
  if (!minus) {
    if (readOnly) return null;
    return (
      <button
        type="button"
        className={linkClass}
        onClick={() => {
          setPickingField(false);
          onChange({ ...form, minus: { kind: "number", value: 0 } });
        }}
      >
        {tr("measureSubtract", d)}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden>−</span>
      <Select
        aria-label={tr("measureSubtractKind", d)}
        className={inputClass}
        disabled={readOnly}
        value={kind}
        onChange={(e) => {
          const next = e.target.value as Minus["kind"];
          setPickingField(next === "field");
          if (next === "number")
            onChange({ ...form, minus: { kind: "number", value: 0 } });
        }}
      >
        <option value="number">{tr("measureSubtractNumber", d)}</option>
        <option value="field">{tr("measureSubtractField", d)}</option>
      </Select>
      {kind === "number" ? (
        <NumberValue
          value={minus.kind === "number" ? minus.value : 0}
          unit={null}
          label={tr("measureSubtractNumber", d)}
          readOnly={readOnly}
          onChange={(value) =>
            onChange({ ...form, minus: { kind: "number", value } })
          }
        />
      ) : (
        <FieldCombobox
          value={minus.kind === "field" ? minus.path : ""}
          fields={numeric.filter((f) => f.path !== form.field)}
          readOnly={readOnly}
          d={d}
          onChange={(f) =>
            onChange({ ...form, minus: { kind: "field", path: f.path } })
          }
        />
      )}
      {!readOnly && (
        <button
          type="button"
          aria-label={tr("measureSubtractRemove", d)}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-white"
          onClick={() => {
            setPickingField(false);
            onChange({ ...form, minus: null });
          }}
        >
          <HiX className="h-4 w-4" />
        </button>
      )}
    </span>
  );
}

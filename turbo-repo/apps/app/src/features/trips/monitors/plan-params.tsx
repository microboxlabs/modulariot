"use client";

import { Select, TextInput } from "flowbite-react";
import { HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { STAGE_TYPES, type ParamValue, type StagePlan } from "./monitors-api";

import { useRowKeys } from "./use-row-keys";

const REMOVE =
  "rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700";
const ADD =
  "flex w-fit items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400";

/** The stages a trip gets when it is created without stages, in order. */
export function PlanEditor({
  plan,
  onChange,
  readOnly,
  d,
  emptyText,
}: Readonly<{
  plan: StagePlan[];
  onChange: (plan: StagePlan[]) => void;
  readOnly: boolean;
  d: I18nRecord;
  /** Shown with no stages; the monitors' "trips bring their stages" by default. */
  emptyText?: string;
}>) {
  const unused = STAGE_TYPES.filter(
    (s) => !plan.some((p) => p.stageType === s)
  );
  const set = (i: number, p: StagePlan) =>
    onChange(plan.map((x, j) => (j === i ? p : x)));
  return (
    <div className="flex flex-col gap-2">
      {plan.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {emptyText ?? tr("planEmpty", d)}
        </p>
      )}
      {plan.map((p, i) => (
        <div key={p.stageType} className="flex items-center gap-2">
          <span className="w-6 text-right text-xs text-gray-400">{i + 1}</span>
          <Select
            sizing="sm"
            value={p.stageType}
            disabled={readOnly}
            aria-label={tr("stageType", d)}
            onChange={(e) => set(i, { ...p, stageType: e.target.value })}
          >
            {[p.stageType, ...unused].map((s) => (
              <option key={s} value={s}>
                {tr(`stages.${s}`, d)}
              </option>
            ))}
          </Select>
          <TextInput
            sizing="sm"
            className="flex-1"
            value={p.serviceStatus ?? ""}
            disabled={readOnly}
            placeholder={tr("serviceStatus", d)}
            aria-label={tr("serviceStatus", d)}
            onChange={(e) =>
              set(i, { ...p, serviceStatus: e.target.value || null })
            }
          />
          {!readOnly && (
            <button
              type="button"
              className={REMOVE}
              aria-label={tr("removeStage", d)}
              onClick={() => onChange(plan.filter((_, j) => j !== i))}
            >
              <HiX className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {!readOnly && unused.length > 0 && (
        <button
          type="button"
          className={ADD}
          onClick={() =>
            onChange([...plan, { stageType: unused[0], serviceStatus: null }])
          }
        >
          <HiPlus className="h-3.5 w-3.5" />
          {tr("addStage", d)}
        </button>
      )}
    </div>
  );
}

type ParamType = "number" | "bool" | "text";

function typeOf(v: ParamValue): ParamType {
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "bool";
  return "text";
}

function convert(type: ParamType, v: ParamValue): ParamValue {
  if (type === "number") return Number(v) || 0;
  if (type === "bool") return v === true || v === "true";
  return String(v);
}

/** Values the rules read as `params.<name>`. */
export function ParamsEditor({
  params,
  onChange,
  readOnly,
  d,
}: Readonly<{
  params: Record<string, ParamValue>;
  onChange: (params: Record<string, ParamValue>) => void;
  readOnly: boolean;
  d: I18nRecord;
}>) {
  const entries = Object.entries(params);
  const rowKeys = useRowKeys(entries.length);
  const replace = (i: number, name: string, value: ParamValue) => {
    if (entries.some(([existing], index) => index !== i && existing === name))
      return;
    onChange(
      Object.fromEntries(
        entries.map(([n, v], j) => (j === i ? [name, value] : [n, v]))
      )
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {entries.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("paramsEmpty", d)}
        </p>
      )}
      {entries.map(([name, value], i) => (
        // Names can change without replacing the input.
        <div key={rowKeys.keys[i]} className="flex items-center gap-2">
          <TextInput
            sizing="sm"
            className="w-56 font-mono"
            value={name}
            disabled={readOnly}
            aria-label={tr("paramName", d)}
            onChange={(e) => replace(i, e.target.value, value)}
          />
          <Select
            sizing="sm"
            value={typeOf(value)}
            disabled={readOnly}
            aria-label={tr("paramType", d)}
            onChange={(e) =>
              replace(i, name, convert(e.target.value as ParamType, value))
            }
          >
            <option value="number">{tr("paramTypes.number", d)}</option>
            <option value="bool">{tr("paramTypes.bool", d)}</option>
            <option value="text">{tr("paramTypes.text", d)}</option>
          </Select>
          {typeof value === "boolean" ? (
            <Select
              sizing="sm"
              value={String(value)}
              disabled={readOnly}
              aria-label={tr("paramValue", d)}
              onChange={(e) => replace(i, name, e.target.value === "true")}
            >
              <option value="true">{tr("yes", d)}</option>
              <option value="false">{tr("no", d)}</option>
            </Select>
          ) : (
            <TextInput
              sizing="sm"
              className="flex-1"
              type={typeof value === "number" ? "number" : "text"}
              value={String(value)}
              disabled={readOnly}
              aria-label={tr("paramValue", d)}
              onChange={(e) =>
                replace(
                  i,
                  name,
                  typeof value === "number"
                    ? Number(e.target.value)
                    : e.target.value
                )
              }
            />
          )}
          {!readOnly && (
            <button
              type="button"
              className={REMOVE}
              aria-label={tr("removeParam", d)}
              onClick={() => {
                rowKeys.remove(i);
                onChange(Object.fromEntries(entries.filter((_, j) => j !== i)));
              }}
            >
              <HiX className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          className={ADD}
          onClick={() => {
            let n = entries.length + 1;
            while (`param${n}` in params) n++;
            rowKeys.append();
            onChange({ ...params, [`param${n}`]: 0 });
          }}
        >
          <HiPlus className="h-3.5 w-3.5" />
          {tr("addParam", d)}
        </button>
      )}
    </div>
  );
}

"use client";

import { FaCheck } from "react-icons/fa";
import { HiExclamation } from "react-icons/hi";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { TripSheet } from "./sheet-api";

/** A check from an external system: true, false, or not reported. */
export type CheckValue = boolean | undefined;

export interface Check {
  key: string;
  label: string;
  value: CheckValue;
  title?: string;
}

const TRUE = new Set(["true", "1", "yes", "si", "sí", "ok", "passed"]);
const FALSE = new Set(["false", "0", "no", "failed"]);

/** Booleans as they are; "true"/"false" and their usual spellings as booleans; anything else is not reported. */
export function checkValue(value: unknown): CheckValue {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if (TRUE.has(v)) return true;
  if (FALSE.has(v)) return false;
  return undefined;
}

/** A key the source sent as a check: a boolean, null, or a boolean spelled as text. */
function isCheck(value: unknown) {
  return value === null || checkValue(value) !== undefined;
}

/**
 * The checks the source sent with the milestones before departure
 * (presentation, then validation). `equipment.gps` belongs to group
 * `equipment`; a key without a dot has no group.
 */
export function serviceChecks(sheet: TripSheet): Check[] {
  const evidence: Record<string, unknown> = {};
  for (const name of ["presentation", "validation"] as const) {
    const m = sheet.milestones.find((x) => x.milestone === name);
    Object.assign(evidence, m?.evidence ?? {});
  }
  return Object.entries(evidence)
    .filter(([, v]) => isCheck(v))
    .map(([key, v]) => ({ key, label: key, value: checkValue(v) }));
}

/** Checks under the text before the first dot of their key, in the order they came. */
export function groupChecks(checks: Check[]) {
  const groups = new Map<string, Check[]>();
  for (const c of checks) {
    const dot = c.key.indexOf(".");
    const group = dot > 0 ? c.key.slice(0, dot) : "";
    const label = dot > 0 ? c.key.slice(dot + 1) : c.key;
    groups.set(group, [...(groups.get(group) ?? []), { ...c, label }]);
  }
  return [...groups.entries()];
}

const OUTER = "flex h-5 w-5 shrink-0 items-center justify-center rounded-full";

/** Gray tick for true, yellow mark for false, an empty circle when not reported. */
export function CheckIcon({ value }: Readonly<{ value: CheckValue }>) {
  if (value === true) {
    return (
      <span className={`${OUTER} bg-gray-400 p-1 text-white`}>
        <FaCheck className="h-3 w-3" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className={`${OUTER} bg-yellow-400 text-white`}>
        <HiExclamation className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span
      className={`${OUTER} border-2 border-gray-400 bg-white dark:bg-gray-800`}
    />
  );
}

export function CheckList({ checks }: Readonly<{ checks: Check[] }>) {
  return (
    <ul className="flex flex-col gap-1.5">
      {checks.map((c) => (
        <li key={c.key} className="flex items-center gap-2" title={c.title}>
          <CheckIcon value={c.value} />
          <span className="text-sm text-gray-800 dark:text-gray-200">
            {c.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The service's checks before departure: equipment (GPS) and cargo, grouped by key prefix. */
export function ServiceValidations({
  sheet,
  d,
}: Readonly<{ sheet: TripSheet; d: I18nRecord }>) {
  const groups = groupChecks(serviceChecks(sheet));
  return (
    <CustomCard title={tr("sheet.validations", d)} subtitle={null}>
      {groups.length === 0 ? (
        <p className="text-sm font-light text-gray-500 dark:text-gray-400">
          {tr("sheet.noValidations", d)}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([group, checks]) => (
            <div key={group || "-"}>
              {group && (
                <h3 className="mb-1.5 text-sm font-normal text-gray-500 dark:text-gray-400">
                  {group}
                </h3>
              )}
              <CheckList checks={checks} />
            </div>
          ))}
        </div>
      )}
    </CustomCard>
  );
}

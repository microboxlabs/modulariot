"use client";

import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  Button,
  Label,
  Spinner,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";

const SECTION =
  "rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";
const HINT = "text-xs text-gray-500 dark:text-gray-400";

/** A number input of the plan, with its bounds. */
export interface PlanField {
  id: string;
  label: string;
  value: string;
  min: number;
  max?: number;
  step: number;
  onChange: (value: string) => void;
}

/**
 * A metered plan (geocoding, telephony): title, description and hints, the
 * "apply the quotas" switch, a grid of number fields, notes, the problem with
 * the draft and the save button.
 */
export default function UsagePlanSection({
  icon: Icon,
  title,
  description,
  hint,
  isLoading,
  loadError,
  enforced,
  fields,
  notes,
  problem,
  isSaving,
  saveLabel,
  savingLabel,
  onSave,
}: Readonly<{
  icon: IconType;
  title: string;
  description: string;
  hint: string;
  isLoading: boolean;
  /** The message when the plan did not load, or null. */
  loadError: string | null;
  /** Null until the plan loaded. */
  enforced: {
    checked: boolean;
    label: string;
    help: string;
    onChange: (checked: boolean) => void;
  } | null;
  fields: readonly PlanField[];
  /** Below the fields: what counts, where the alerts go. */
  notes?: ReactNode;
  problem: string | null;
  isSaving: boolean;
  saveLabel: string;
  savingLabel: string;
  onSave: () => void;
}>) {
  return (
    <section className={SECTION}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
      <p className={`mt-1 ${HINT}`}>{hint}</p>

      {isLoading && <Spinner size="sm" className="mt-3" />}
      {loadError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {loadError}
        </p>
      )}

      {enforced && (
        <>
          <div className="mt-4">
            <ToggleSwitch
              checked={enforced.checked}
              label={enforced.label}
              onChange={enforced.onChange}
            />
            <p className={`mt-1 ${HINT}`}>{enforced.help}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {fields.map((f) => (
              <div key={f.id}>
                <Label htmlFor={f.id}>{f.label}</Label>
                <TextInput
                  id={f.id}
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                />
              </div>
            ))}
          </div>
          {notes}

          {problem && (
            <p
              role="alert"
              className="mt-3 text-sm text-red-600 dark:text-red-400"
            >
              {problem}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <Button size="sm" color="blue" disabled={isSaving} onClick={onSave}>
              {isSaving ? savingLabel : saveLabel}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

/** A note under the plan's fields. */
export function PlanNote({
  first = false,
  children,
}: Readonly<{ first?: boolean; children: ReactNode }>) {
  return <p className={`${first ? "mt-2" : "mt-1"} ${HINT}`}>{children}</p>;
}

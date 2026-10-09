import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type { SymptomState } from "../maintainer-api";
import { stateLabel } from "../symptom-labels";
import { CHANGED } from "./changed";

const PILL: Record<SymptomState, string> = {
  ACTIVE:
    "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400",
  TEST: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300",
  OFF: "border-gray-300 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const BUTTON: Record<SymptomState, string> = {
  ACTIVE: "bg-green-600 text-white",
  TEST: "bg-violet-600 text-white",
  OFF: "bg-gray-500 text-white",
};

const HELP: Record<SymptomState, string> = {
  ACTIVE: "stateActiveHelp",
  TEST: "stateTestHelp",
  OFF: "stateOffHelp",
};

/** Off, test, active: the order the toggle shows them in. */
export const STATES: SymptomState[] = ["OFF", "TEST", "ACTIVE"];

export function StatePill({
  state,
  d,
}: Readonly<{ state: SymptomState; d: I18nRecord }>) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PILL[state]}`}
    >
      {stateLabel(state, d)}
    </span>
  );
}

export function StateToggle({
  value,
  onChange,
  d,
  disabled = false,
  changed = false,
}: Readonly<{
  value: SymptomState;
  onChange: (state: SymptomState) => void;
  d: I18nRecord;
  disabled?: boolean;
  changed?: boolean;
}>) {
  return (
    <div
      className={`flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600 ${changed ? CHANGED : ""}`}
    >
      {STATES.map((s) => (
        <button
          key={s}
          type="button"
          title={trDynamic(HELP[s], d)}
          disabled={disabled}
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={`rounded-md px-3 py-1 text-xs font-medium ${
            value === s
              ? BUTTON[s]
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          {stateLabel(s, d)}
        </button>
      ))}
    </div>
  );
}

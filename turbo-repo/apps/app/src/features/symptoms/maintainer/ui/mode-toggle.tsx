import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { EditMode } from "../level-row";

/** ☰ form / { } expression, as in the prototype. `d` holds `formMode` and `exprMode`. */
export default function ModeToggle({
  mode,
  d,
  onChange,
}: Readonly<{
  mode: EditMode;
  d: I18nRecord;
  onChange: (mode: EditMode) => void;
}>) {
  const button = (m: EditMode, label: string, title: string) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={mode === m}
      className={`rounded-md px-2 py-0.5 text-xs ${mode === m ? "bg-gray-100 font-medium dark:bg-gray-700" : "text-gray-500 dark:text-gray-400"}`}
      onClick={() => onChange(m)}
    >
      {label}
    </button>
  );
  return (
    <span className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
      {button("form", "☰", tr("formMode", d))}
      {button("expr", "{ }", tr("exprMode", d))}
    </span>
  );
}

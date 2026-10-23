import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

function Tab({
  active,
  label,
  hint,
  onClick,
}: Readonly<{
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}>) {
  const tone = active
    ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500"
    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={hint}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${tone}`}
    >
      {label}
    </button>
  );
}

/** "Regla" (when a case opens and how serious it is) or "Respuesta" (what the tower does). */
export default function WorkspaceTabs({
  response,
  d,
  onRule,
  onResponse,
}: Readonly<{
  response: boolean;
  d: I18nRecord;
  onRule: () => void;
  onResponse: () => void;
}>) {
  return (
    <div
      role="tablist"
      className="flex border-b border-gray-200 dark:border-gray-700"
    >
      <Tab
        active={!response}
        label={tr("workspaceRule", d)}
        hint={tr("workspaceRuleHint", d)}
        onClick={onRule}
      />
      <Tab
        active={response}
        label={tr("workspaceResponse", d)}
        hint={tr("workspaceResponseHint", d)}
        onClick={onResponse}
      />
    </div>
  );
}

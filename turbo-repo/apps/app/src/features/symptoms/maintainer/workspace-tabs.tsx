import type { KeyboardEvent } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export const WORKSPACE_PANEL_ID = "symptom-workspace-panel";
const RULE_TAB_ID = "symptom-workspace-rule";
const RESPONSE_TAB_ID = "symptom-workspace-response";

/** The id of the tab that labels the panel. */
export function workspaceTabId(response: boolean): string {
  return response ? RESPONSE_TAB_ID : RULE_TAB_ID;
}

function Tab({
  id,
  active,
  label,
  hint,
  onClick,
}: Readonly<{
  id: string;
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
      id={id}
      aria-selected={active}
      aria-controls={WORKSPACE_PANEL_ID}
      tabIndex={active ? 0 : -1}
      title={hint}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${tone}`}
    >
      {label}
    </button>
  );
}

const KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

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
  // Two tabs: the arrows switch to the other one, Home and End pick the first and last.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!KEYS.has(e.key)) return;
    e.preventDefault();
    let next = !response;
    if (e.key === "Home") next = false;
    if (e.key === "End") next = true;
    if (next) onResponse();
    else onRule();
    document.getElementById(workspaceTabId(next))?.focus();
  };
  return (
    <div
      role="tablist"
      className="flex border-b border-gray-200 dark:border-gray-700"
      onKeyDown={onKeyDown}
    >
      <Tab
        id={RULE_TAB_ID}
        active={!response}
        label={tr("workspaceRule", d)}
        hint={tr("workspaceRuleHint", d)}
        onClick={onRule}
      />
      <Tab
        id={RESPONSE_TAB_ID}
        active={response}
        label={tr("workspaceResponse", d)}
        hint={tr("workspaceResponseHint", d)}
        onClick={onResponse}
      />
    </div>
  );
}

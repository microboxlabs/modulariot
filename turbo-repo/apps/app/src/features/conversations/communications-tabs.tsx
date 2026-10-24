import type { KeyboardEvent } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";

export const COMMUNICATIONS_TABS = ["rules", "activity"] as const;
export type CommunicationsTab = (typeof COMMUNICATIONS_TABS)[number];

export const COMMUNICATIONS_PANEL_ID = "communications-panel";

export const tabId = (tab: CommunicationsTab) => `communications-tab-${tab}`;

const LABEL: Record<CommunicationsTab, string> = {
  rules: "tabRules",
  activity: "tabActivity",
};

/** Reglas and Actividad: arrows move between them, Home and End pick the first and last. */
export default function CommunicationsTabs({
  tab,
  d,
  onTab,
}: Readonly<{
  tab: CommunicationsTab;
  d: I18nRecord;
  onTab: (tab: CommunicationsTab) => void;
}>) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = COMMUNICATIONS_TABS.indexOf(tab);
    const n = COMMUNICATIONS_TABS.length;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % n;
    if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = n - 1;
    if (next === null) return;
    e.preventDefault();
    const target = COMMUNICATIONS_TABS[next];
    onTab(target);
    document.getElementById(tabId(target))?.focus();
  };
  return (
    <div
      role="tablist"
      className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700"
      onKeyDown={onKeyDown}
    >
      {COMMUNICATIONS_TABS.map((t) => {
        const active = t === tab;
        const tone = active
          ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";
        return (
          <button
            key={t}
            type="button"
            role="tab"
            id={tabId(t)}
            aria-selected={active}
            aria-controls={COMMUNICATIONS_PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onTab(t)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium ${tone}`}
          >
            {trDynamic(LABEL[t], d)}
          </button>
        );
      })}
    </div>
  );
}

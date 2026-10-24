"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useControlTowerAccess } from "@/features/symptoms/maintainer/maintainer-api";
import { MUTED, Tile } from "@/features/symptoms/maintainer/ui/card";
import { FilterChip } from "@/features/symptoms/maintainer/ui/filter-chip";
import ActivityTab, {
  type ActivityFilters,
  activityFilterDefs,
  NO_ACTIVITY_FILTERS,
} from "./activity-tab";
import CommunicationsTabs, {
  COMMUNICATIONS_PANEL_ID,
  COMMUNICATIONS_TABS,
  tabId,
  type CommunicationsTab,
} from "./communications-tabs";
import { useConversationRules, useEventCatalog } from "./conversations-api";
import LayoutToggle from "./layout-toggle";
import NewRuleModal, {
  type NewRulePrefill,
  prefillFrom,
} from "./new-rule-modal";
import RulesTab, {
  NO_RULE_FILTERS,
  ruleHref,
  type RuleFilters,
  ruleFilterDefs,
  type RulesLayout,
} from "./rules-tab";

type FilterDef = { key: string; label: string; options: string[] };

function tabOf(value: string | null): CommunicationsTab {
  return (COMMUNICATIONS_TABS as readonly string[]).includes(value ?? "")
    ? (value as CommunicationsTab)
    : "rules";
}

/** Settings › Comunicaciones: the rules that send messages on events, and what they did. Templates are the platform's. */
export default function CommunicationsPage({
  dict,
  lang,
}: Readonly<{ dict: I18nRecord; lang: string }>) {
  const d = dict?.communications as I18nRecord;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = tabOf(params.get("tab"));
  const { canMaintain, loaded } = useControlTowerAccess();
  const { data: rules } = useConversationRules();
  const { data: catalog } = useEventCatalog();
  const [ruleFilters, setRuleFilters] = useState<RuleFilters>(NO_RULE_FILTERS);
  const [activityFilters, setActivityFilters] =
    useState<ActivityFilters>(NO_ACTIVITY_FILTERS);
  const [layout, setLayout] = useState<RulesLayout>("cards");
  const [newRule, setNewRule] = useState<NewRulePrefill | null>(null);
  // A link from a symptom's Respuesta tab opens the modal already filled in.
  const linked = prefillFrom(params);
  const creating = newRule ?? linked;

  const replaceQuery = (q: URLSearchParams) => {
    const query = q.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const onTab = (next: CommunicationsTab) => {
    const q = new URLSearchParams(params.toString());
    if (next === "rules") q.delete("tab");
    else q.set("tab", next);
    replaceQuery(q);
  };

  const closeNewRule = () => {
    setNewRule(null);
    if (!linked) return;
    const q = new URLSearchParams(params.toString());
    for (const k of ["new", "event", "when", "name"]) q.delete(k);
    replaceQuery(q);
  };

  const filterBar = (): {
    defs: FilterDef[];
    value: (key: string) => string;
    set: (key: string, value: string) => void;
  } => {
    if (tab === "activity") {
      return {
        defs: activityFilterDefs(rules ?? [], d),
        value: (k) => activityFilters[k as keyof ActivityFilters],
        set: (k, v) => setActivityFilters({ ...activityFilters, [k]: v }),
      };
    }
    return {
      defs: ruleFilterDefs(rules ?? [], catalog, d),
      value: (k) => ruleFilters[k as keyof RuleFilters],
      set: (k, v) => setRuleFilters({ ...ruleFilters, [k]: v }),
    };
  };
  const bar = filterBar();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "communications"]}
          disableLinks
        />
      </div>

      {bar.defs.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-900">
          {bar.defs.map((f) => (
            <FilterChip
              key={`${tab}-${f.key}`}
              label={f.label}
              value={bar.value(f.key)}
              options={f.options}
              allLabel={tr("filterAll", d)}
              onChange={(v) => bar.set(f.key, v)}
            />
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 pb-10 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tile>
              <svg
                aria-hidden
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="M4 5h16v10H8l-4 4V5Z" />
              </svg>
            </Tile>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("title", d)}
              </h1>
              <p className={`text-sm ${MUTED}`}>{tr("description", d)}</p>
            </div>
            {tab === "rules" && (
              <div className="ml-auto flex items-center gap-2">
                <LayoutToggle layout={layout} d={d} onLayout={setLayout} />
                {canMaintain && (
                  <button
                    type="button"
                    onClick={() => setNewRule({})}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                  >
                    ＋ {tr("newRule", d)}
                  </button>
                )}
              </div>
            )}
          </div>
          <CommunicationsTabs tab={tab} d={d} onTab={onTab} />
          <div
            role="tabpanel"
            id={COMMUNICATIONS_PANEL_ID}
            aria-labelledby={tabId(tab)}
          >
            {tab === "rules" && (
              <RulesTab
                lang={lang}
                filters={ruleFilters}
                layout={layout}
                d={d}
              />
            )}
            {tab === "activity" && (
              <ActivityTab lang={lang} filters={activityFilters} d={d} />
            )}
          </div>
        </div>
      </div>
      <NewRuleModal
        open={creating !== null}
        prefill={creating ?? {}}
        canWrite={canMaintain}
        accessKnown={loaded}
        d={d}
        onClose={closeNewRule}
        onCreated={(created) => router.push(ruleHref(lang, created.rule.id))}
      />
    </div>
  );
}

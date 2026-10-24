"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HiOutlineClipboardList, HiOutlineClock } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import SectionMenu, {
  type SectionMenuEntry,
} from "@/features/common/components/section-menu";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useControlTowerAccess } from "@/features/symptoms/maintainer/maintainer-api";
import { MUTED, Tile } from "@/features/symptoms/maintainer/ui/card";
import { FilterChip } from "@/features/symptoms/maintainer/ui/filter-chip";
import ActivityTab, {
  type ActivityFilters,
  activityFilterDefs,
  NO_ACTIVITY_FILTERS,
} from "./activity-tab";
import { channelLogo } from "./channel-icon";
import ChannelPanel from "./channel-panel";
import { CHANNEL_TYPES, channelType } from "./channel-types";
import {
  channelKeyOf,
  channelSection,
  type CommunicationsSection,
  DEFAULT_SECTION,
  sectionOf,
} from "./communications-sections";
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

/** Settings › Comunicaciones: rules, what they did, and the channels they send through. Templates are the platform's. */
export default function CommunicationsPage({
  dict,
  lang,
}: Readonly<{ dict: I18nRecord; lang: string }>) {
  const d = dict?.communications as I18nRecord;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const section = sectionOf(params);
  const channel = channelType(channelKeyOf(section) ?? "");
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

  const onSection = (next: CommunicationsSection) => {
    const q = new URLSearchParams(params.toString());
    q.delete("tab");
    if (next === DEFAULT_SECTION) q.delete("section");
    else q.set("section", next);
    replaceQuery(q);
  };

  const closeNewRule = () => {
    setNewRule(null);
    if (!linked) return;
    const q = new URLSearchParams(params.toString());
    for (const k of ["new", "event", "when", "name"]) q.delete(k);
    replaceQuery(q);
  };

  const sections: SectionMenuEntry<CommunicationsSection>[] = [
    {
      id: "rules",
      label: tr("tabRules", d),
      description: tr("menuRules", d),
      icon: HiOutlineClipboardList,
    },
    {
      id: "activity",
      label: tr("tabActivity", d),
      description: tr("menuActivity", d),
      icon: HiOutlineClock,
    },
    ...CHANNEL_TYPES.map((c) => ({
      id: channelSection(c.key),
      label: trDynamic(`channel_${c.key}`, d),
      description: trDynamic(`channelMenu_${c.key}`, d),
      icon: channelLogo(c.key),
      group: tr("menuChannels", d),
    })),
  ];

  const filterBar = (): {
    defs: FilterDef[];
    value: (key: string) => string;
    set: (key: string, value: string) => void;
  } | null => {
    if (section === "activity") {
      return {
        defs: activityFilterDefs(rules ?? [], d),
        value: (k) => activityFilters[k as keyof ActivityFilters],
        set: (k, v) => setActivityFilters({ ...activityFilters, [k]: v }),
      };
    }
    if (section === "rules") {
      return {
        defs: ruleFilterDefs(rules ?? [], catalog, d),
        value: (k) => ruleFilters[k as keyof RuleFilters],
        set: (k, v) => setRuleFilters({ ...ruleFilters, [k]: v }),
      };
    }
    return null;
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

      <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col gap-4 px-4 pb-6 pt-4">
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
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
          <SectionMenu
            title={tr("menuTitle", d)}
            sections={sections}
            selected={section}
            onSelect={onSection}
          />
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
            {bar && (
              <div className="flex flex-wrap items-center gap-2">
                {bar.defs.map((f) => (
                  <FilterChip
                    key={`${section}-${f.key}`}
                    label={f.label}
                    value={bar.value(f.key)}
                    options={f.options}
                    allLabel={tr("filterAll", d)}
                    onChange={(v) => bar.set(f.key, v)}
                  />
                ))}
                {section === "rules" && (
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
            )}
            {section === "rules" && (
              <RulesTab
                lang={lang}
                filters={ruleFilters}
                layout={layout}
                d={d}
              />
            )}
            {section === "activity" && (
              <ActivityTab lang={lang} filters={activityFilters} d={d} />
            )}
            {channel && <ChannelPanel channel={channel} d={d} />}
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
        onCreated={(created) => {
          const href = ruleHref(lang, created.rule.id);
          // A link's ?new=1 entry is replaced, so Back does not reopen the modal.
          if (linked) {
            router.replace(href);
            return;
          }
          setNewRule(null);
          router.push(href);
        }}
      />
    </div>
  );
}

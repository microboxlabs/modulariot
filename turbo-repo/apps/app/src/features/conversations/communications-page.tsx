"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "flowbite-react";
import {
  HiChatAlt2,
  HiOutlineClipboardList,
  HiOutlineClock,
  HiPlus,
} from "react-icons/hi";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import SectionMenu, {
  type SectionMenuEntry,
} from "@/features/common/components/section-menu";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { isPlatformScope } from "@/features/common/platform-scope";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { useControlTowerAccess } from "@/features/symptoms/maintainer/maintainer-api";
import { FilterChip } from "@/features/symptoms/maintainer/ui/filter-chip";
import ActivityTab, {
  type ActivityFilters,
  activityFilterDefs,
  NO_ACTIVITY_FILTERS,
} from "./activity-tab";
import { channelLogo } from "./channel-icon";
import ChannelPanel from "./channel-panel";
import ConnectionChannelPanel from "./connection-channel-panel";
import {
  CHANNEL_TYPES,
  channelType,
  isConnectionChannel,
} from "./channel-types";
import {
  channelKeyOf,
  channelSection,
  type CommunicationsSection,
  DEFAULT_SECTION,
  sectionOf,
  sectionsFor,
} from "./communications-sections";
import { useConversationRules, useEventCatalog } from "./conversations-api";
import LayoutToggle from "@/features/common/components/layout-toggle";
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
  connectionsDict,
  lang,
}: Readonly<{ dict: I18nRecord; connectionsDict: I18nRecord; lang: string }>) {
  const d = dict?.communications as I18nRecord;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { canMaintain, loaded } = useControlTowerAccess();
  const { activeOrg } = useOrgScopes();
  const platformScope = isPlatformScope(activeOrg?.slug);
  const section = sectionOf(params, platformScope);
  const channel = channelType(channelKeyOf(section) ?? "");
  // Accounts hold secrets: organization owners set them up, and platform owners the platform's.
  const canConfigureChannels =
    activeOrg?.role === "OWNER" || activeOrg?.role === "PLATFORM_OWNER";
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

  const allSections: SectionMenuEntry<CommunicationsSection>[] = [
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
  const offered = sectionsFor(platformScope);
  const sections = allSections.filter((s) => offered.includes(s.id));

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
    <SettingsPageShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      path={["user", "settings", "communications"]}
      icon={HiChatAlt2}
      title={tr("title", d)}
      description={tr("description", d)}
      actions={
        section === "rules" &&
        canMaintain && (
          <Button size="sm" color="blue" onClick={() => setNewRule({})}>
            <HiPlus className="mr-1 h-4 w-4" />
            {tr("newRule", d)}
          </Button>
        )
      }
    >
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
                <div className="ml-auto">
                  <LayoutToggle
                    layout={layout}
                    labels={{
                      cards: tr("viewCards", d),
                      list: tr("viewList", d),
                    }}
                    onLayout={setLayout}
                  />
                </div>
              )}
            </div>
          )}
          {section === "rules" && (
            <RulesTab lang={lang} filters={ruleFilters} layout={layout} d={d} />
          )}
          {section === "activity" && (
            <ActivityTab lang={lang} filters={activityFilters} d={d} />
          )}
          {channel && isConnectionChannel(channel.key) && (
            <ConnectionChannelPanel
              channelKey={channel.key}
              d={d}
              connectionsDict={connectionsDict}
              lang={lang}
              canMaintain={canMaintain}
            />
          )}
          {channel && !isConnectionChannel(channel.key) && (
            <ChannelPanel
              channel={channel}
              d={d}
              settingsDict={dict}
              orgSlug={activeOrg?.slug ?? null}
              platformScope={platformScope}
              canConfigure={canConfigureChannels}
            />
          )}
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
    </SettingsPageShell>
  );
}

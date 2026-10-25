"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "flowbite-react";
import {
  HiChatAlt2,
  HiOutlineClipboardList,
  HiOutlineClock,
  HiOutlineDocumentText,
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
import MetaTemplatesSection from "./meta-templates-section";
import MessageTemplatesPanel, {
  NEW_TEMPLATE,
  platformTemplateHref,
  TEMPLATE_CHANNELS,
} from "./platform-templates-catalog";
import { channelLabel } from "./rule-model";
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

/**
 * Settings › Comunicaciones: rules, what they did, and the channels they send through. In the platform scope:
 * the message templates every organization's rules send, and the platform's accounts.
 */
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
  const [templateChannel, setTemplateChannel] = useState("");
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
    {
      id: "templates",
      label: tr("templatesTitle", d),
      description: platformScope
        ? tr("menuTemplates", d)
        : tr("menuTemplatesOrg", d),
      icon: HiOutlineDocumentText,
      group: tr("tabTemplates", d),
    },
    {
      id: "meta",
      label: tr("templatesMeta", d),
      description: tr("menuMeta", d),
      icon: channelLogo("whatsapp"),
      group: tr("tabTemplates", d),
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
    if (section === "templates") {
      return {
        defs: [
          {
            key: "channel",
            label: tr("filterChannel", d),
            options: TEMPLATE_CHANNELS.map((c) => channelLabel(c, d)),
          },
        ],
        value: () => templateChannel,
        set: (_, v) => setTemplateChannel(v),
      };
    }
    return null;
  };
  const bar = filterBar();
  const catalogLayout = section === "rules" || section === "templates";
  // Until the scope is known (still loading, or the read failed), render nothing rather than the organization's sections.
  if (!activeOrg) return null;

  return (
    <SettingsPageShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      path={["user", "settings", "communications"]}
      icon={HiChatAlt2}
      title={tr("title", d)}
      description={tr("description", d)}
      filters={
        bar &&
        bar.defs.length > 0 &&
        bar.defs.map((f) => (
          <FilterChip
            key={`${section}-${f.key}`}
            label={f.label}
            value={bar.value(f.key)}
            options={f.options}
            allLabel={tr("filterAll", d)}
            onChange={(v) => bar.set(f.key, v)}
          />
        ))
      }
      actions={
        <div className="flex shrink-0 items-center gap-2">
          {catalogLayout && (
            <LayoutToggle
              layout={layout}
              labels={{
                cards: tr("viewCards", d),
                list: tr("viewList", d),
              }}
              onLayout={setLayout}
            />
          )}
          {section === "rules" && canMaintain && (
            <Button size="sm" color="blue" onClick={() => setNewRule({})}>
              <HiPlus className="mr-1 h-4 w-4" />
              {tr("newRule", d)}
            </Button>
          )}
          {section === "templates" && platformScope && (
            <Link
              href={platformTemplateHref(lang, NEW_TEMPLATE)}
              className="inline-flex items-center rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              <HiPlus className="mr-1 h-4 w-4" />
              {tr("newTemplate", d)}
            </Link>
          )}
        </div>
      }
    >
      {/* Below md the menu and the detail stack and scroll together; from md only the detail scrolls. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 max-md:overflow-y-auto md:grid-cols-[320px_1fr]">
        <SectionMenu
          title={tr("menuTitle", d)}
          sections={sections}
          selected={section}
          onSelect={onSection}
        />
        <div className="flex min-h-0 flex-col gap-4 pr-1 md:overflow-y-auto">
          {section === "rules" && (
            <RulesTab lang={lang} filters={ruleFilters} layout={layout} d={d} />
          )}
          {section === "activity" && (
            <ActivityTab lang={lang} filters={activityFilters} d={d} />
          )}
          {section === "templates" && (
            <MessageTemplatesPanel
              channel={templateChannel}
              layout={layout}
              lang={lang}
              d={d}
              readOnly={!platformScope}
            />
          )}
          {section === "meta" && <MetaTemplatesSection canWrite d={d} />}
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

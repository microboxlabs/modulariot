"use client";

import Link from "next/link";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { stateLabel } from "@/features/symptoms/maintainer/symptom-labels";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { STATES, StatePill } from "@/features/symptoms/maintainer/ui/state";
import ChannelIcon from "./channel-icon";
import { useConversationRules, useEventCatalog } from "./conversations-api";
import type { EventTypeInfo, RuleSummary } from "./conversations-types";
import { channelLabel, eventLabel, triggerSummary } from "./rule-model";
import { useSymptomNames } from "./use-symptom-names";

export const COMMUNICATIONS_PAGE = "/users/settings/communications";

export const ruleHref = (lang: string, id: string) =>
  `/${lang}${COMMUNICATIONS_PAGE}/rules/${encodeURIComponent(id)}`;

export function stepsText(n: number, d: I18nRecord) {
  if (n === 0) return tr("noStepsShort", d);
  return n === 1 ? tr("oneStep", d) : tr("stepsCount", d, { n: String(n) });
}

export type RuleFilterKey = "state" | "event" | "channel";
export type RuleFilters = Record<RuleFilterKey, string>;
export type RulesLayout = "cards" | "list";

export const NO_RULE_FILTERS: RuleFilters = {
  state: "",
  event: "",
  channel: "",
};

/** The filter chips over the rules: their options come from the rules there are. */
export function ruleFilterDefs(
  rules: RuleSummary[],
  catalog: EventTypeInfo[] | undefined,
  d: I18nRecord
): { key: RuleFilterKey; label: string; options: string[] }[] {
  const events = rules.flatMap((r) =>
    r.trigger?.event ? [eventLabel(r.trigger.event, d, catalog)] : []
  );
  const channels = rules.flatMap((r) =>
    (r.channels ?? []).map((c) => channelLabel(c, d))
  );
  return [
    {
      key: "state",
      label: tr("filterState", d),
      options: [...STATES].reverse().map((s) => stateLabel(s, d)),
    },
    {
      key: "event",
      label: tr("filterEvent", d),
      options: [...new Set(events)],
    },
    {
      key: "channel",
      label: tr("filterChannel", d),
      options: [...new Set(channels)],
    },
  ];
}

export function rulePasses(
  rule: RuleSummary,
  f: RuleFilters,
  d: I18nRecord,
  catalog?: EventTypeInfo[]
) {
  if (f.state && stateLabel(rule.state, d) !== f.state) return false;
  if (f.event) {
    const event = rule.trigger?.event;
    if (!event || eventLabel(event, d, catalog) !== f.event) return false;
  }
  if (
    f.channel &&
    !(rule.channels ?? []).some((c) => channelLabel(c, d) === f.channel)
  )
    return false;
  return true;
}

/** The channels a rule uses, as icons. */
export function ChannelIcons({
  channels,
  d,
}: Readonly<{ channels: string[]; d: I18nRecord }>) {
  return (
    <span className="flex items-center gap-1">
      {channels.map((c) => (
        <ChannelIcon key={c} channel={c} label={channelLabel(c, d)} size={6} />
      ))}
    </span>
  );
}

function DraftBadge({ d }: Readonly<{ d: I18nRecord }>) {
  return (
    <span className="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
      {tr("draftBadge", d)}
    </span>
  );
}

function versionText(rule: RuleSummary, d: I18nRecord) {
  return rule.currentVersion ? `v${rule.currentVersion}` : tr("unpublished", d);
}

export function RuleCard({
  rule,
  summary,
  href,
  d,
}: Readonly<{
  rule: RuleSummary;
  summary: string;
  href: string;
  d: I18nRecord;
}>) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700/60"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatePill state={rule.state} d={d} />
        {rule.hasDraft && <DraftBadge d={d} />}
        <span className={`ml-auto text-xs ${MUTED}`}>
          {versionText(rule, d)}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
          {rule.name}
        </h3>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
          {summary}
        </p>
      </div>
      <div className="mt-auto flex items-center gap-2 text-xs">
        <span className={MUTED}>{stepsText(rule.stepsCount, d)}</span>
        <span className="ml-auto">
          <ChannelIcons channels={rule.channels ?? []} d={d} />
        </span>
      </div>
    </Link>
  );
}

/** A rule as a table row; its name opens it. */
export function RuleRow({
  rule,
  summary,
  href,
  d,
}: Readonly<{
  rule: RuleSummary;
  summary: string;
  href: string;
  d: I18nRecord;
}>) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link
            href={href}
            className="text-sm font-medium text-gray-900 hover:underline dark:text-white"
          >
            {rule.name}
          </Link>
          {rule.hasDraft && <DraftBadge d={d} />}
        </div>
      </td>
      <td className="px-4 py-2.5">{summary}</td>
      <td className="whitespace-nowrap px-4 py-2.5">
        {stepsText(rule.stepsCount, d)}
      </td>
      <td className="px-4 py-2.5">
        <ChannelIcons channels={rule.channels ?? []} d={d} />
      </td>
      <td className="px-4 py-2.5">
        <StatePill state={rule.state} d={d} />
      </td>
      <td className={`whitespace-nowrap px-4 py-2.5 ${MUTED}`}>
        {versionText(rule, d)}
      </td>
    </tr>
  );
}

function RulesTable({
  rules,
  summaryOf,
  lang,
  d,
}: Readonly<{
  rules: RuleSummary[];
  summaryOf: (r: RuleSummary) => string;
  lang: string;
  d: I18nRecord;
}>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          <tr>
            <th className="px-4 py-2">{tr("colRule", d)}</th>
            <th className="px-4 py-2">{tr("colWhen", d)}</th>
            <th className="px-4 py-2">{tr("colSteps", d)}</th>
            <th className="px-4 py-2">{tr("colChannels", d)}</th>
            <th className="px-4 py-2">{tr("filterState", d)}</th>
            <th className="px-4 py-2">{tr("colVersion", d)}</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              summary={summaryOf(r)}
              href={ruleHref(lang, r.id)}
              d={d}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Reglas": the rules that pass the filters, as cards or as a table. */
export default function RulesTab({
  lang,
  filters,
  layout,
  d,
}: Readonly<{
  lang: string;
  filters: RuleFilters;
  layout: RulesLayout;
  d: I18nRecord;
}>) {
  const { data: rules, error, isLoading } = useConversationRules();
  const { data: catalog } = useEventCatalog();
  const symptomName = useSymptomNames();
  const shown = (rules ?? []).filter((r) => rulePasses(r, filters, d, catalog));
  const summaryOf = (r: RuleSummary) =>
    triggerSummary(r.trigger, d, symptomName, catalog);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {tr("loadFailed", d)}
        </p>
      )}
      {isLoading && <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>}
      {rules?.length === 0 && (
        <p
          className={`rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm dark:border-gray-600 dark:bg-gray-800 ${MUTED}`}
        >
          {tr("noRules", d)}
        </p>
      )}
      {rules && rules.length > 0 && shown.length === 0 && (
        <p className={`py-10 text-center text-sm ${MUTED}`}>
          {tr("rulesEmptyFiltered", d)}
        </p>
      )}
      {shown.length > 0 && layout === "cards" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((r) => (
            <RuleCard
              key={r.id}
              rule={r}
              summary={summaryOf(r)}
              href={ruleHref(lang, r.id)}
              d={d}
            />
          ))}
        </div>
      )}
      {shown.length > 0 && layout === "list" && (
        <RulesTable rules={shown} summaryOf={summaryOf} lang={lang} d={d} />
      )}
    </div>
  );
}

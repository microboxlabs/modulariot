"use client";

import Link from "next/link";
import { HiPlus } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { StatePill } from "@/features/symptoms/maintainer/ui/state";
import ChannelIcon from "./channel-icon";
import { useConversationRules, useEventCatalog } from "./conversations-api";
import type { RuleSummary } from "./conversations-types";
import { channelLabel, triggerSummary } from "./rule-model";
import { useSymptomNames } from "./use-symptom-names";

export const COMMUNICATIONS_PAGE = "/users/settings/communications";

export const ruleHref = (lang: string, id: string) =>
  `/${lang}${COMMUNICATIONS_PAGE}/rules/${encodeURIComponent(id)}`;

export function stepsText(n: number, d: I18nRecord) {
  if (n === 0) return tr("noStepsShort", d);
  return n === 1 ? tr("oneStep", d) : tr("stepsCount", d, { n: String(n) });
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
        {rule.hasDraft && (
          <span className="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
            {tr("draftBadge", d)}
          </span>
        )}
        <span className={`ml-auto text-xs ${MUTED}`}>
          {rule.currentVersion
            ? `v${rule.currentVersion}`
            : tr("unpublished", d)}
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

/** "Reglas": one card per rule, and "Nueva regla". */
export default function RulesTab({
  lang,
  canWrite,
  d,
}: Readonly<{ lang: string; canWrite: boolean; d: I18nRecord }>) {
  const { data: rules, error, isLoading } = useConversationRules();
  const { data: catalog } = useEventCatalog();
  const symptomName = useSymptomNames();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className={`min-w-0 flex-1 text-sm ${MUTED}`}>
          {tr("rulesIntro", d)}
        </p>
        {canWrite && (
          <Link
            href={`/${lang}${COMMUNICATIONS_PAGE}/rules/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            <HiPlus aria-hidden className="h-4 w-4" />
            {tr("newRule", d)}
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {tr("loadFailed", d)}
        </p>
      )}
      {isLoading && <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>}
      {rules && rules.length === 0 && (
        <p
          className={`rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm dark:border-gray-600 dark:bg-gray-800 ${MUTED}`}
        >
          {tr("noRules", d)}
        </p>
      )}
      {rules && rules.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rules.map((r) => (
            <RuleCard
              key={r.id}
              rule={r}
              summary={triggerSummary(r.trigger, d, symptomName, catalog)}
              href={ruleHref(lang, r.id)}
              d={d}
            />
          ))}
        </div>
      )}
    </div>
  );
}

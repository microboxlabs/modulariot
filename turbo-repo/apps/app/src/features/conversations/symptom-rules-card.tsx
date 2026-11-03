"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { HiPlus } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { ResponseBlock } from "@/features/symptoms/maintainer/ui/response-block";
import { useConversationRules, useEventCatalog } from "./conversations-api";
import { newRuleHref } from "./new-rule-modal";
import {
  eventFullLabel,
  ruleTargets,
  SYMPTOM_OPENED,
  symptomLevelWhen,
  triggerSummary,
} from "./rule-model";
import { RULE_CARD_GRID, RuleCard, ruleHref } from "./rules-tab";

/**
 * "Comunicaciones" in a level's response: the conversation rules whose
 * trigger names this symptom and reaches this level, as the same cards the
 * Comunicaciones page shows, and a link to add one. `d` is the symptom
 * editor's dictionary; `rulesDict` the Comunicaciones page's, which the cards read.
 */
export default function SymptomRulesCard({
  symptomKey,
  symptomName,
  icu,
  canWrite,
  d,
  rulesDict,
}: Readonly<{
  symptomKey: string;
  symptomName: string;
  icu: number;
  canWrite: boolean;
  d: I18nRecord;
  rulesDict: I18nRecord;
}>) {
  const { lang } = useParams<{ lang: string }>();
  const { data, error } = useConversationRules();
  const { data: catalog } = useEventCatalog();
  const rules = (data ?? []).filter((r) => ruleTargets(r, symptomKey, icu));
  // The rules here name this symptom; its name is known without fetching the list.
  const nameOf = (key: string) =>
    key === symptomKey ? symptomName : undefined;
  const href = newRuleHref(lang, {
    event: SYMPTOM_OPENED,
    when: symptomLevelWhen(symptomKey, icu),
    name: tr("newRuleForLevelName", d, {
      symptom: symptomName,
      level: trDynamic(`levelName${icu}`, d),
    }),
  });

  return (
    <ResponseBlock
      number={1}
      title={tr("communicationsTitle", d)}
      subtitle={tr("communicationsSub", d)}
    >
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {tr("communicationsLoadFailed", d)}
        </p>
      )}
      {!error && rules.length === 0 && (
        <p className={`text-sm ${MUTED}`}>{tr("communicationsSoon", d)}</p>
      )}
      {rules.length > 0 && (
        <ul
          aria-label={tr("communicationsTitle", d)}
          className={RULE_CARD_GRID}
        >
          {rules.map((r) => (
            <li key={r.id} className="grid">
              <RuleCard
                rule={r}
                event={
                  r.trigger?.event
                    ? eventFullLabel(r.trigger.event, rulesDict, catalog)
                    : ""
                }
                summary={triggerSummary(r.trigger, rulesDict, nameOf, catalog)}
                href={ruleHref(lang, r.id)}
                lang={lang}
                d={rulesDict}
              />
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <Link
          href={href}
          className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          <HiPlus aria-hidden className="h-4 w-4" />
          {tr("newRuleForLevel", d)}
        </Link>
      )}
    </ResponseBlock>
  );
}

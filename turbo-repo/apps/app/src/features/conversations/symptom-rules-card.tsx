"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { HiPlus } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { ResponseBlock } from "@/features/symptoms/maintainer/ui/response-block";
import { StatePill } from "@/features/symptoms/maintainer/ui/state";
import ChannelIcon from "./channel-icon";
import { useConversationRules } from "./conversations-api";
import { newRuleHref } from "./new-rule-modal";
import { ruleTargets, SYMPTOM_OPENED, symptomLevelWhen } from "./rule-model";
import { ruleHref } from "./rules-tab";

function stepsLabel(n: number, d: I18nRecord) {
  if (n === 0) return tr("ruleStepsNone", d);
  return n === 1
    ? tr("ruleStepsOne", d)
    : tr("ruleStepsCount", d, { n: String(n) });
}

const CHANNEL_KEY: Record<string, string> = {
  whatsapp: "channelWhatsapp",
  email: "channelEmail",
  preferred: "channelPreferred",
};

/**
 * "Comunicaciones" in a level's response: the conversation rules whose
 * trigger names this symptom and reaches this level, and a link to add one.
 * `d` is the symptom editor's dictionary.
 */
export default function SymptomRulesCard({
  symptomKey,
  symptomName,
  icu,
  canWrite,
  d,
}: Readonly<{
  symptomKey: string;
  symptomName: string;
  icu: number;
  canWrite: boolean;
  d: I18nRecord;
}>) {
  const { lang } = useParams<{ lang: string }>();
  const { data, error } = useConversationRules();
  const rules = (data ?? []).filter((r) => ruleTargets(r, symptomKey, icu));
  // StatePill reads stateOff/stateTest/stateActive; a rule's state is feminine in Spanish.
  const stateDict = {
    stateOff: tr("ruleStateOff", d),
    stateTest: tr("ruleStateTest", d),
    stateActive: tr("ruleStateActive", d),
  };
  const href = newRuleHref(lang, {
    event: SYMPTOM_OPENED,
    when: symptomLevelWhen(symptomKey, icu),
    name: tr("newRuleForLevelName", d, {
      symptom: symptomName,
      level: trDynamic(`levelName${icu}`, d),
    }),
  });

  return (
    <ResponseBlock title={tr("communicationsTitle", d)}>
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
          className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700"
        >
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
            >
              <StatePill state={r.state} d={stateDict} />
              <Link
                href={ruleHref(lang, r.id)}
                className="min-w-0 font-medium text-gray-900 hover:text-blue-600 hover:underline dark:text-white dark:hover:text-blue-400"
              >
                {r.name}
              </Link>
              <span className={`ml-auto text-xs ${MUTED}`}>
                {stepsLabel(r.stepsCount, d)}
              </span>
              <span className="flex items-center gap-1">
                {(r.channels ?? []).map((c) => (
                  <ChannelIcon
                    key={c}
                    channel={c}
                    label={CHANNEL_KEY[c] ? trDynamic(CHANNEL_KEY[c], d) : c}
                    size={6}
                  />
                ))}
              </span>
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

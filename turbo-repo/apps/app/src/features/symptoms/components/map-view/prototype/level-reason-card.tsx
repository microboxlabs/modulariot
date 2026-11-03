"use client";

import { HiQuestionMarkCircle } from "react-icons/hi";
import { FormattedDate } from "@/features/common/components/formatted-date";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  type LevelReason,
  summarizeReason,
} from "@/features/symptoms/model/level-reason";
import { titles } from "@/features/symptoms/types/symptom-titles";

/** Why the case is at its level: the silence, the level's rule and the flags. */
export default function LevelReasonCard({
  dict,
  reason,
}: Readonly<{ dict: I18nRecord; reason: LevelReason | null | undefined }>) {
  const summary = summarizeReason(reason, dict);
  if (!reason || !summary) return null;
  const levelTitle =
    titles[String(reason.icu_code) as keyof typeof titles]?.title;
  const levelLabel = levelTitle
    ? ((dict.symptoms as I18nRecord)[levelTitle] as string)
    : String(reason.icu_code);
  const hasContext = !!reason.context;
  return (
    <section
      aria-label={tr("symptoms.level_reason.title", dict)}
      className="flex flex-col gap-1 rounded-md border border-gray-300 p-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
    >
      <h2 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
        <HiQuestionMarkCircle className="h-5 w-5" />
        {tr("symptoms.level_reason.title", dict)}
      </h2>
      <p>
        {tr("symptoms.level_reason.level", dict)}:{" "}
        <span className="font-medium">{levelLabel}</span>
      </p>
      {summary.silenceMinutes !== null && (
        <p>
          {tr("symptoms.level_reason.silence", dict)}:{" "}
          <span className="font-medium">
            {summary.silenceMinutes} {tr("symptoms.level_reason.minutes", dict)}
          </span>
          {reason.lost_since && (
            <>
              {" · "}
              {tr("symptoms.level_reason.since", dict)}{" "}
              <FormattedDate date={reason.lost_since} format="datetime" />
            </>
          )}
        </p>
      )}
      {summary.rule && (
        <p>
          {tr("symptoms.level_reason.rule", dict)}:{" "}
          <code className="break-all rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
            {summary.rule}
          </code>
        </p>
      )}
      {summary.flags.length > 0 && (
        <ul className="flex flex-col gap-1">
          {summary.flags.map((flag) => (
            <li
              key={flag.key}
              className="rounded bg-amber-50 px-2 py-1 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
            >
              {flag.label}
              {flag.value && (
                <span className="font-light"> ({flag.value})</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {summary.details.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
          {summary.details.map((line) => (
            <div key={line.key} className="contents">
              <dt className="text-gray-500 dark:text-gray-400">{line.label}</dt>
              <dd className="break-all">
                {line.key === "check.loss.last.at" ? (
                  <FormattedDate date={line.value} format="datetime" />
                ) : (
                  line.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!hasContext && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("symptoms.level_reason.no_context", dict)}
        </p>
      )}
    </section>
  );
}

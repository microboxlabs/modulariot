"use client";

import { Button } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { PublishPlan, ValidationReport } from "./maintainer-api";
import { BumpBadge } from "./ui/badges";
import { MUTED } from "./ui/card";

/** Errors in the latest check of the draft, else in its publish plan. */
export function errorCount(
  report: ValidationReport | null,
  plan: PublishPlan | undefined
) {
  const findings = report?.findings ?? plan?.report.findings ?? [];
  return findings.filter((f) => f.severity === "ERROR").length;
}

function draftLabel(changes: number, d: I18nRecord) {
  if (changes === 0) return tr("draftNoChanges", d);
  if (changes === 1) return tr("draftOneChange", d);
  return tr("draftChanges", d, { n: String(changes) });
}

/**
 * The bar at the bottom of the symptom page while there is a draft, as in
 * the prototype: how many changes, the version they make, the errors that
 * block publishing, and the actions.
 */
export default function DraftBar({
  plan,
  report,
  saving,
  saveError,
  d,
  onReview,
  onDiscard,
}: Readonly<{
  plan: PublishPlan | undefined;
  report: ValidationReport | null;
  saving: boolean;
  saveError: string | null;
  d: I18nRecord;
  onReview: () => void;
  onDiscard: () => void;
}>) {
  const changes = plan?.changes.length ?? 0;
  const errors = errorCount(report, plan);
  if (!plan) return null;

  return (
    <section
      aria-label={tr("draftBarLabel", d)}
      className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t border-amber-300 bg-white/95 px-6 py-3 text-sm shadow-lg dark:border-amber-600/60 dark:bg-gray-800/95"
    >
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      <span className="text-gray-900 dark:text-white">
        {draftLabel(changes, d)}
      </span>
      {plan.nextVersion && plan.bump && (
        <>
          <span className={`text-xs ${MUTED}`}>{tr("nextVersion", d)}</span>
          <span className="font-mono text-gray-900 dark:text-white">
            {plan.nextVersion}
          </span>
          <BumpBadge bump={plan.bump} d={d} />
        </>
      )}
      {errors > 0 && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {errors === 1
            ? tr("oneError", d)
            : tr("errorsCount", d, { n: String(errors) })}
        </span>
      )}
      <span className={`text-xs ${MUTED}`}>
        {saving ? tr("saving", d) : tr("saved", d)}
      </span>
      {saveError && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {saveError}
        </span>
      )}
      <button
        type="button"
        className="text-blue-600 hover:underline dark:text-blue-400"
        onClick={onReview}
      >
        {tr("seeChanges", d)}
      </button>
      <button
        type="button"
        className={`ml-auto hover:underline ${MUTED}`}
        onClick={onDiscard}
      >
        {tr("discard", d)}
      </button>
      <Button
        size="sm"
        disabled={errors > 0 || saving || changes === 0}
        onClick={onReview}
      >
        {tr("publish", d)}
      </Button>
    </section>
  );
}

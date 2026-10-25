"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { PublishPlan, ValidationReport } from "./maintainer-api";
import { MUTED } from "./ui/card";
import DraftActions from "./ui/draft-actions";

/** Errors in the latest check of the draft, else in its publish plan. */
export function errorCount(
  report: ValidationReport | null,
  plan: PublishPlan | undefined
) {
  const findings = report?.findings ?? plan?.report.findings ?? [];
  return findings.filter((f) => f.severity === "ERROR").length;
}

/**
 * The draft's part of the symptom's header: how many
 * changes, the version they make, the errors that block publishing, and the
 * actions.
 */
export default function DraftBar({
  plan,
  planFailed,
  report,
  saving,
  saveError,
  d,
  onReview,
  onDiscard,
}: Readonly<{
  plan: PublishPlan | undefined;
  /** The plan request failed; the bar stays so the draft can still be discarded. */
  planFailed: boolean;
  report: ValidationReport | null;
  saving: boolean;
  saveError: string | null;
  d: I18nRecord;
  onReview: () => void;
  onDiscard: () => void;
}>) {
  const changes = plan?.changes.length ?? 0;
  const errors = errorCount(report, plan);
  // Publishing needs a plan that matches what was saved: none while it loads, after a failed save, or with errors.
  const blocked =
    !plan || errors > 0 || saving || saveError !== null || changes === 0;

  return (
    <DraftActions
      changes={plan ? changes : null}
      nextVersion={plan?.nextVersion ?? null}
      bump={plan?.bump ?? null}
      errors={errors}
      saving={saving}
      saveError={saveError}
      notice={
        !plan && (
          <span
            role={planFailed ? "alert" : "status"}
            className={`text-xs ${planFailed ? "text-red-600 dark:text-red-400" : MUTED}`}
          >
            {planFailed ? tr("planFailed", d) : tr("loading", d)}
          </span>
        )
      }
      canReview={Boolean(plan)}
      canPublish={!blocked}
      d={d}
      onReview={onReview}
      onDiscard={onDiscard}
    />
  );
}

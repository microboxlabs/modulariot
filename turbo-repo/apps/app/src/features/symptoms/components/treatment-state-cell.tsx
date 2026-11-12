"use client";

import { Badge } from "flowbite-react";
import { FormattedDate } from "@/features/common/components/formatted-date";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { IgnoredInfo } from "@/features/symptoms/model/ignore-hold";
import {
  otherOperators,
  treatmentOperator,
  type CaseTreatment,
  type TreatmentState,
} from "@/features/symptoms/model/treatment-state";

const STATE_COLOR: Record<TreatmentState, "gray" | "warning" | "success"> = {
  untreated: "gray",
  in_treatment: "warning",
  treated: "success",
};

const STATE_LABEL = {
  untreated: "symptoms.treatment_state_untreated",
  in_treatment: "symptoms.treatment_state_in_treatment",
  treated: "symptoms.treatment_state_treated",
} as const;

const OUTCOME_LABEL = {
  call: "symptoms.treatment_outcome_call",
  handling: "symptoms.treatment_outcome_handling",
  ignore: "symptoms.treatment_outcome_ignore",
  invalidate: "symptoms.treatment_outcome_invalidate",
} as const;

function operatorFor(
  state: TreatmentState,
  shown: CaseTreatment | null | undefined,
  ignored?: IgnoredInfo | null
) {
  if (ignored) return ignored.by;
  const others = otherOperators(shown);
  if (state === "in_treatment" && others.length) return others.join(", ");
  return treatmentOperator(shown);
}

const TYPE_LABEL = {
  CALL: "symptoms.treatment_outcome_call",
  IGNORE_CONDITION: "symptoms.treatment_outcome_ignore",
  INVALIDATE_SYMPTOM: "symptoms.treatment_outcome_invalidate",
} as const;

/**
 * A case's treatment state, with who handled it and when. A treated case says
 * how it was handled (call, handling record, ignore, invalidation); a held
 * case shows as ignored by whoever set the hold.
 */
export default function TreatmentStateCell({
  state,
  treatment,
  ignored,
  dict,
  compact = false,
}: Readonly<{
  state: TreatmentState | null | undefined;
  treatment: CaseTreatment | null | undefined;
  ignored?: IgnoredInfo | null;
  dict: I18nRecord;
  /** Only who handled the case, for the symptoms table. */
  compact?: boolean;
}>) {
  if (!state) return <span className="text-gray-400">—</span>;

  const outcome = ignored ? "ignore" : treatment?.outcome;
  const outcomeLabel = outcome ? trDynamic(OUTCOME_LABEL[outcome], dict) : null;
  // An untreated case that came back from a hold keeps its last treatment for the record only.
  const shown = state === "untreated" ? null : treatment;
  const operator = operatorFor(state, shown, ignored);
  const openedAt = shown?.opened_at ?? ignored?.since;
  const closedAt = shown?.closed_at;
  const typeLabel =
    shown?.type && shown.type in TYPE_LABEL
      ? trDynamic(TYPE_LABEL[shown.type as keyof typeof TYPE_LABEL], dict)
      : null;

  if (compact) {
    // The table shows who handled the case; the rest is in the tooltip and the case page.
    const detail = [
      trDynamic(STATE_LABEL[state], dict),
      state !== "untreated" ? outcomeLabel : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <span
        className="text-xs font-medium"
        data-testid="treatment-state"
        title={detail}
      >
        {operator ?? trDynamic(STATE_LABEL[state], dict)}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5" data-testid="treatment-state">
      <div className="flex items-center gap-1">
        <Badge color={STATE_COLOR[state]} className="w-fit">
          {trDynamic(STATE_LABEL[state], dict)}
        </Badge>
        {state !== "untreated" && outcomeLabel && (
          <span title={shown?.outcome_label ?? undefined}>{outcomeLabel}</span>
        )}
      </div>
      {typeLabel && typeLabel !== outcomeLabel && (
        <span className="text-[11px] opacity-80">{typeLabel}</span>
      )}
      {openedAt && (
        <span className="text-[11px] font-normal opacity-80">
          {tr("symptoms.treatment_opened_at", dict)}:{" "}
          <FormattedDate date={openedAt} format="datetime" />
        </span>
      )}
      {closedAt && (
        <span className="text-[11px] font-normal opacity-80">
          {tr("symptoms.treatment_closed_at", dict)}:{" "}
          <FormattedDate date={closedAt} format="datetime" />
        </span>
      )}
      {operator && (
        <span className="text-[11px] font-normal opacity-80">
          {tr("symptoms.treatment_by", dict, { operator })}
        </span>
      )}
    </div>
  );
}

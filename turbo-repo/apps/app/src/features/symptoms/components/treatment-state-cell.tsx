"use client";

import { Badge } from "flowbite-react";
import { FormattedDate } from "@/features/common/components/formatted-date";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { IgnoredInfo } from "@/features/symptoms/model/ignore-hold";
import {
  otherOperators,
  treatmentAt,
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
}: Readonly<{
  state: TreatmentState | null | undefined;
  treatment: CaseTreatment | null | undefined;
  ignored?: IgnoredInfo | null;
  dict: I18nRecord;
}>) {
  if (!state) return <span className="text-gray-400">—</span>;

  const outcome = ignored ? "ignore" : treatment?.outcome;
  const outcomeLabel = outcome ? trDynamic(OUTCOME_LABEL[outcome], dict) : null;
  // An untreated case that came back from a hold keeps its last treatment for the record only.
  const shown = state === "untreated" ? null : treatment;
  const others = otherOperators(shown);
  const operator = ignored
    ? ignored.by
    : state === "in_treatment" && others.length
      ? others.join(", ")
      : treatmentOperator(shown);
  const at = ignored ? ignored.since : treatmentAt(shown);

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
      {(operator || at) && (
        <span className="text-[11px] font-normal opacity-80">
          {at && <FormattedDate date={at} format="datetime" />}
          {operator && (
            <>
              {at && " · "}
              {tr("symptoms.treatment_by", dict, { operator })}
            </>
          )}
        </span>
      )}
    </div>
  );
}

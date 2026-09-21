"use client";

/**
 * PROTOTYPE — the same amber-bordered "current symptom" card the timeline
 * shows for the selected sub-item (see `timeline-group.tsx`'s `isSelected`
 * branch), reused standalone so it can float at the bottom of the map while
 * the operator is on a call — the symptom context stays visible without
 * having to flip back to the timeline.
 *
 * Capped to 50% of the map column's height (a fixed `50vh`) so a long
 * treatments list can't push the map itself down to nothing — the whole
 * card scrolls as one unit past that cap. An earlier version tried to keep
 * only the treatments section scrolling (via nested `flex-1`/`min-h-0`
 * chains) while everything above stayed fixed, but that relies on this
 * card's `max-height` propagating as a *definite* height for those nested
 * flex-grow calculations, which it doesn't reliably do coming from the
 * parent's grid-rows mount-animation trick — the treatments list ended up
 * rendering at a barely-visible sliver instead. Scrolling the whole card is
 * far more robust, at the cost of the symptom title scrolling out of view
 * with everything else.
 */

import { FaImages } from "react-icons/fa";
import ConditionIcon from "../../../condition-icon";
import { FormattedDate } from "@/features/common/components/formatted-date";
import { ConditionsAgg } from "@/features/symptoms/types/timeline";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import TreatmentsTimelineBox from "../../treatments-timeline-box";

function formatLongEmails(emails: string) {
  const emailSize = 15;
  if (emails.length < emailSize) return emails;
  return emails.slice(0, emailSize) + "...";
}

export default function SymptomContextCard({
  dict,
  subItem,
}: {
  dict: I18nRecord;
  subItem: ConditionsAgg;
}) {
  return (
    <div className="flex max-h-[50vh] flex-row gap-2 overflow-y-auto rounded-md border border-amber-300 bg-white p-2 shadow-md dark:bg-gray-900">
      <div className="flex flex-col">
        <ConditionIcon
          condition={subItem?.icu_condition?.toLowerCase() ?? ""}
          size="h-5 w-5"
          dict={dict}
        />
        <div className="mx-auto mt-1 w-[2px] flex-grow bg-gray-400" />
      </div>
      <div className="flex w-full flex-col">
        <div className="flex shrink-0 flex-row justify-between">
          <p className="flex h-7 items-center text-sm font-medium text-gray-600 dark:text-gray-300">
            <FormattedDate date={subItem.start} format="time" />
            {"  "}|{" "}
            {subItem.start && subItem.end && (
              <>
                {Math.floor(
                  (new Date(subItem.end).getTime() -
                    new Date(subItem.start).getTime()) /
                    60000
                )}
              </>
            )}{" "}
            min
          </p>
          <div className="flex flex-grow flex-row justify-end gap-1">
            {subItem.evidences && subItem.evidences?.length > 0 && (
              <small className="flex items-center gap-1 rounded-md bg-gray-100 px-2 text-xs dark:bg-gray-800">
                <FaImages className="text-gray-600 dark:text-gray-400" size={15} />
                <p className="text-gray-800 dark:text-gray-200">
                  {subItem.evidences?.length}
                </p>
              </small>
            )}
            {subItem.assigned_to && (
              <small className="flex items-center rounded-md bg-blue-200 px-2 text-xs">
                {formatLongEmails(
                  ((dict.symptoms as I18nRecord)[
                    subItem.assigned_to
                  ] as string) ?? subItem.assigned_to
                )}
              </small>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
            {((dict.symptoms as I18nRecord)[subItem.type] as string) ??
              subItem.type}
          </p>
          {typeof subItem.symptom_description == "string" && (
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {((dict.symptoms as I18nRecord)[
                subItem.symptom_description
              ] as string) ?? subItem.symptom_description}
            </p>
          )}
          {subItem.treatments.length > 0 && (
            <div className="mt-2">
              <TreatmentsTimelineBox
                dict={dict}
                treatments={subItem.treatments}
                seed={`${subItem.symptom_id ?? "symptom"}`}
                start={subItem.start}
                end={subItem.end}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { TableRow, TableCell, Button, Badge } from "flowbite-react";
import {
  treatmentHref,
  continueTreatmentHref,
} from "@/features/symptoms/model/treatment-link";
import ConditionIcon from "./condition-icon";
import { Conditions, TableItemType } from "./table-item.type";
import { HiArrowRight } from "react-icons/hi";
import Link from "next/link";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { FormattedDate } from "@/features/common/components/formatted-date";
import icu_condition from "@/features/symptoms/model/icu_condition.json";
import { FaChevronRight } from "react-icons/fa6";
import IgnoredHoldCell from "./ignored-hold-cell";
import TreatmentStateCell from "./treatment-state-cell";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  caseActionOf,
  otherOperators,
  type CaseAction,
} from "@/features/symptoms/model/treatment-state";

/** Cell content that opens the case's treatment, as the "Tratar" button does. */
const ROW_LINK =
  "-m-1 flex w-fit items-center gap-2 rounded-md p-1 cursor-pointer hover:bg-black/5 hover:underline dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** The trip's current plate under the case's, when the truck was replaced after the case opened. */
function TripPlateNow({
  data,
  dict,
}: Readonly<{ data: TableItemType; dict: I18nRecord }>) {
  if (!data.tripPlateNow) return null;
  return (
    <span className="block text-[11px] font-normal text-amber-700 dark:text-amber-400">
      {tr("symptoms.trip_plate_now", dict, { plate: data.tripPlateNow })}
    </span>
  );
}

const ACTION_LABEL = {
  treat: "symptoms.diagnose",
  continue: "symptoms.continue_treatment",
  view_treatment: "symptoms.view_treatment",
  view_case: "symptoms.view_case",
} as const;

/**
 * The row's button: "Tratar" only for an open case nobody treats, "Continuar"
 * for the user's own open treatment, else a link that only shows the case.
 * A case another operator treats says who.
 */
function RowAction({
  data,
  href,
  dict,
}: Readonly<{ data: TableItemType; href: string; dict: I18nRecord }>) {
  // A held case has an open treatment, the hold: it is resumed, not continued.
  const action: CaseAction = data.ignored
    ? "view_treatment"
    : caseActionOf(data.treatmentState, data.treatment, !!data.endDate);
  const others =
    data.treatmentState === "in_treatment" && !data.ignored
      ? otherOperators(data.treatment)
      : [];
  const primary = action === "treat" || action === "continue";
  return (
    <Button
      as={Link}
      className="h-8 flex justify-center items-center !text-xs"
      color={primary ? "blue" : "light"}
      href={action === "continue" ? continueTreatmentHref(href) : href}
      title={
        others.length
          ? tr("symptoms.treating_by_other", dict, {
              operator: others.join(", "),
            })
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        <p>{trDynamic(ACTION_LABEL[action], dict)}</p>
        <HiArrowRight className="w-4 h-4" />
      </div>
    </Button>
  );
}

function slaBadge(data: TableItemType, dict: I18nRecord) {
  const slaMin = data.sla_minutes;
  // A badge, not plain colored text: the row itself is already tinted by
  // condition (`Conditions[...].bgColor` below), and a saturated row color —
  // red especially — could wash out same-colored text with no background of
  // its own to stand on.
  let slaCell: {
    texto: string;
    color: "warning" | "success" | "failure";
  } | null = null;
  if (slaMin != null) {
    // The server's SLA start: the case reached its level, or came back from a hold.
    const slaStart = data.slaSince ?? data.returnedAfterIgnoreAt ?? data.date;
    const transc = (Date.now() - new Date(slaStart).getTime()) / 60000;
    const resto = slaMin - transc;
    const fmt = (m: number) =>
      m >= 90 ? `${Math.round(m / 60)} h` : `${Math.max(1, Math.round(m))} min`;
    slaCell =
      resto >= 0
        ? {
            texto: `⏱ ${(dict.symptoms as I18nRecord).sla_left as string} ${fmt(resto)}`,
            color: resto <= slaMin * 0.3 ? "warning" : "success",
          }
        : {
            texto: `⏱ ${(dict.symptoms as I18nRecord).sla_overdue as string} ${fmt(-resto)}`,
            color: "failure",
          };
  }

  return slaCell;
}

export default function TableItem({
  data,
  dict,
  compact = false,
}: {
  data: TableItemType;
  dict: I18nRecord;
  compact?: boolean;
}) {
  const searchParams = new URLSearchParams(window.location.search);

  // Occurrence number of this event on the trip: earlier events plus this one.
  const occurrence = (data.recurrence_events ?? 0) + 1;
  const slaCell = slaBadge(data, dict);
  const href = treatmentHref(data.id, data.trip, data.licensePlate);
  const openLabel = tr("symptoms.open_treatment", dict, {
    plate: data.licensePlate,
  });

  if (!compact) {
    return (
      <TableRow
        className={`dark:bg-gray-800 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700
        ${Conditions[data.condition as keyof typeof Conditions]?.bgColor}`}
      >
        <TableCell className=" whitespace-nowrap font-medium text-gray-900 dark:text-white">
          <Link href={href} title={openLabel} className={ROW_LINK}>
            {searchParams.get("icu_code") === "6" && (
              <>
                <ConditionIcon
                  condition={icu_condition[
                    data.icu_code as keyof typeof icu_condition
                  ].toLowerCase()}
                  size="h-7 w-7"
                  dict={dict}
                />
                <FaChevronRight className="w-3 h-3" />
              </>
            )}

            <ConditionIcon
              condition={data.condition}
              size="h-7 w-7"
              dict={dict}
            />
            <span
              className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
            >
              {data.licensePlate}
              <TripPlateNow data={data} dict={dict} />
            </span>
          </Link>
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          <Link href={href} title={openLabel} className={ROW_LINK}>
            {(() => {
              const symptomsDict = dict.symptoms as I18nRecord;
              const types = symptomsDict.types as Record<string, string>;
              return types[data.alertType] || data.alertType;
            })()}
          </Link>
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.time} {/* {(dict.symptoms as I18nRecord).sec as string}. */}
        </TableCell>
        <TableCell className="text-xs text-nowrap">
          {data.ignored ? (
            <IgnoredHoldCell info={data.ignored} dict={dict} />
          ) : (
            <div className="flex items-center gap-2">
              {slaCell ? (
                <Badge color={slaCell.color} className="w-fit">
                  {slaCell.texto}
                </Badge>
              ) : (
                <span className="text-gray-400">—</span>
              )}
              {data.returnedAfterIgnoreAt && (
                <Badge color="warning" className="w-fit">
                  {
                    (dict.symptoms as I18nRecord)
                      .returned_after_ignore as string
                  }
                </Badge>
              )}
            </div>
          )}
        </TableCell>
        <TableCell className="text-xs text-nowrap">
          {occurrence > 1 ? (
            <Badge color="purple" className="w-fit">
              ×{occurrence}
            </Badge>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.tripCode?.trim() || data.trip}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.driver}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          <FormattedDate date={data.date} format="datetime" />
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          <TreatmentStateCell
            state={data.treatmentState}
            treatment={data.treatment}
            ignored={data.ignored}
            dict={dict}
          />
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          <div className="flex items-center gap-2">
            {data.last_assigned_to ? (
              <Link href={href}>
                <Button
                  className="h-8 flex justify-center items-center !text-xs"
                  color="light"
                >
                  <div className="flex items-center gap-2">
                    <p>
                      {((dict.symptoms as I18nRecord)[
                        data.last_assigned_to as keyof typeof dict.symptoms
                      ] as string) || data.last_assigned_to}
                    </p>
                    <HiArrowRight className="w-4 h-4" />
                  </div>
                </Button>
              </Link>
            ) : (
              <RowAction data={data} href={href} dict={dict} />
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      className={` text-gray-900 dark:text-white hover:!bg-gray-300 dark:hover:!bg-gray-600 
    ${Conditions[data.condition as keyof typeof Conditions].bgColor} ${Conditions[data.condition as keyof typeof Conditions].hoverColor}  !border-0`}
    >
      <TableCell className=" whitespace-nowrap font-medium text-gray-900 dark:text-white">
        <div className="flex items-center gap-2">
          <ConditionIcon
            condition={data.condition}
            size="h-7 w-7"
            dict={dict}
          />
          <p
            className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
          >
            <Link href={treatmentHref(data.id, data.trip, data.licensePlate)}>
              {data.licensePlate}
            </Link>
            <TripPlateNow data={data} dict={dict} />
          </p>
        </div>
      </TableCell>
      <TableCell
        className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
      >
        {/* {new Date(data.date).toLocaleString()} */}
        <FormattedDate date={data.date} format="datetime" />
      </TableCell>
    </TableRow>
  );
}

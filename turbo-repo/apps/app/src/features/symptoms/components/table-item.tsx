"use client";

import { TableRow, TableCell, Button, Badge } from "flowbite-react";
import ConditionIcon from "./condition-icon";
import { Conditions, TableItemType } from "./table-item.type";
import { HiArrowRight } from "react-icons/hi";
import Link from "next/link";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { FormattedDate } from "@/features/common/components/formatted-date";
import icu_condition from "@/features/symptoms/model/icu_condition.json";
import { FaChevronRight } from "react-icons/fa6";

// SLA declarado por nivel (min) — demo local: espejo de la parametrización
const SLA_MIN: Record<string, number> = { "4": 10, "3": 15, "2": 30 };

export default function TableItem({
  data,
  dict,
  compact = false,
  recurrenceCount = 1,
}: {
  data: TableItemType;
  dict: I18nRecord;
  compact?: boolean;
  recurrenceCount?: number;
}) {
  const searchParams = new URLSearchParams(window.location.search);

  const slaMin = SLA_MIN[data.icu_code] ?? null;
  let slaCell: { texto: string; clase: string } | null = null;
  if (slaMin != null) {
    const transc = (Date.now() - new Date(data.date).getTime()) / 60000;
    const resto = slaMin - transc;
    const fmt = (m: number) =>
      m >= 90 ? `${Math.round(m / 60)} h` : `${Math.max(1, Math.round(m))} min`;
    slaCell =
      resto >= 0
        ? {
            texto: `⏱ ${(dict.symptoms as I18nRecord).sla_left as string} ${fmt(resto)}`,
            clase: resto <= slaMin * 0.3 ? "text-amber-500 font-semibold" : "text-emerald-500",
          }
        : {
            texto: `⏱ ${(dict.symptoms as I18nRecord).sla_overdue as string} ${fmt(-resto)}`,
            clase: "text-red-500 font-semibold",
          };
  }

  if (!compact) {
    return (
      <TableRow
        className={`dark:bg-gray-800 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700
        ${Conditions[data.condition as keyof typeof Conditions]?.bgColor}`}
      >
        <TableCell className=" whitespace-nowrap font-medium text-gray-900 dark:text-white">
          <div className="flex items-center gap-2">
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
            <p
              className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
            >
              {data.licensePlate}
            </p>
          </div>
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {(() => {
            const symptomsDict = dict.symptoms as I18nRecord;
            const types = symptomsDict.types as Record<string, string>;
            return types[data.alertType] || data.alertType;
          })()}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.time} {/* {(dict.symptoms as I18nRecord).sec as string}. */}
        </TableCell>
        <TableCell className="text-xs text-nowrap">
          {slaCell ? <span className={slaCell.clase}>{slaCell.texto}</span> : <span className="text-gray-400">—</span>}
        </TableCell>
        <TableCell className="text-xs text-nowrap">
          {recurrenceCount > 1 ? (
            <Badge color="purple" className="w-fit">×{recurrenceCount}</Badge>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.trip}
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
        {/* <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          
          {data.status}
        </TableCell> */}
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          <div className="flex items-center gap-2">
            {data.last_assigned_to ? (
              <Link
                href={`/symptoms/map-view/${data.id}?tripId=${data.trip}&assetId=${data.licensePlate}`}
              >
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
              <Link
                href={`/symptoms/map-view/${data.id}?tripId=${data.trip}&assetId=${data.licensePlate}`}
              >
                <Button
                  className="h-8 flex justify-center items-center !text-xs"
                  color="blue"
                >
                  <div className="flex items-center gap-2">
                    <p>{(dict.symptoms as I18nRecord).diagnose as string}</p>
                    <HiArrowRight className="w-4 h-4" />
                  </div>
                </Button>
              </Link>
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
            <Link
              href={`/symptoms/map-view/${data.id}?tripId=${data.trip}&assetId=${data.licensePlate}`}
            >
              {data.licensePlate}
            </Link>
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

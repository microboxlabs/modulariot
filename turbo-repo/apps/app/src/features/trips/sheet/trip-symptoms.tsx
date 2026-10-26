"use client";

import Link from "next/link";
import { HiChevronRight } from "react-icons/hi";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import { useSymptomsTable } from "@/features/common/providers/client-api.provider";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import type { TableItemType } from "@/features/symptoms/components/table-item.type";
import { treatmentHref } from "@/features/symptoms/model/treatment-link";
import type { BoardCard } from "../board/board-api";
import { shortTime } from "../board/trip-card";

const PAGE_SIZE = 50;

/**
 * From the trip's start until it ended; no upper bound while it runs, so the
 * list keeps receiving new symptoms on long-lived pages. Without a start, no range:
 * the open symptoms only.
 */
export function symptomRange(card: BoardCard) {
  const from = card.departedAt ?? card.plannedStart;
  if (!from) return undefined;
  return { from, to: card.actualEnd ?? undefined };
}

/** Open symptoms first, then the latest. */
export function orderSymptoms(rows: TableItemType[]) {
  return [...rows].sort(
    (a, b) =>
      Number(Boolean(a.endDate)) - Number(Boolean(b.endDate)) ||
      b.date.localeCompare(a.date)
  );
}

/** The trip's symptoms, as the symptom list filters them by trip; each opens its treatment. */
export function TripSymptoms({
  card,
  d,
  general,
  lang,
}: Readonly<{
  card: BoardCard;
  d: I18nRecord;
  general: I18nRecord;
  lang: string;
}>) {
  const { tableData, loading, error } = useSymptomsTable({
    trip_id: card.tripId,
    pageSize: PAGE_SIZE,
    date_range: symptomRange(card),
  });
  const rows = orderSymptoms(tableData?.data ?? []);
  const note = (text: string) => (
    <p className="text-sm font-light text-gray-500 dark:text-gray-400">
      {text}
    </p>
  );
  let body;
  if (error) body = note(tr("sheet.symptomsError", d));
  else if (loading && !tableData) body = note(tr("loading", d));
  else if (rows.length === 0) body = note(tr("sheet.noSymptoms", d));
  else
    body = (
      <ul className="grid grid-cols-1 gap-1">
        {rows.map((s) => (
          <li key={s.id}>
            <Link
              href={treatmentHref(s.id, s.trip, s.licensePlate)}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-1.5 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              <ConditionIcon
                condition={s.condition}
                size="h-6 w-6"
                dict={general}
                placement="left"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-700 dark:text-gray-200">
                  {s.alertType}
                </span>
                <span className="block truncate text-xs font-light text-gray-500 dark:text-gray-400">
                  {shortTime(s.date, lang)} ·{" "}
                  {s.endDate
                    ? tr("sheet.symptomClosed", d)
                    : `${tr("sheet.symptomOpen", d)} ${s.time}`}
                </span>
              </span>
              <HiChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
            </Link>
          </li>
        ))}
      </ul>
    );
  return (
    <CustomCard title={tr("sheet.symptoms", d)} subtitle={null}>
      {body}
    </CustomCard>
  );
}

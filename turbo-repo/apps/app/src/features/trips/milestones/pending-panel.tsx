"use client";

import { useState } from "react";
import { Badge, Button } from "flowbite-react";
import { HiOutlineCheckCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useTripsPermission } from "../monitors/monitors-api";
import {
  MILESTONE_CONFIRM,
  confirmMilestone,
  rejectMilestone,
  usePendingMilestones,
  type PendingMilestone,
} from "./milestones-api";

function when(iso: string | null, lang: string) {
  return iso
    ? new Date(iso).toLocaleString(lang, {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}

function PendingRow({
  p,
  canConfirm,
  lang,
  d,
  onError,
}: Readonly<{
  p: PendingMilestone;
  canConfirm: boolean;
  lang: string;
  d: I18nRecord;
  onError: (message: string) => void;
}>) {
  const [busy, setBusy] = useState(false);
  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const m = p.milestone;
  const route = [p.origin, p.destination].filter(Boolean).join(" → ");
  const source = m.source === "gps" || m.source === "eta" ? m.source : "other";
  return (
    <tr className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 dark:text-white">
          {p.serviceCode ?? m.tripId.slice(0, 8)}
        </div>
        {route && <div className="text-xs text-gray-500">{route}</div>}
      </td>
      <td className="px-4 py-3">{tr(`names.${m.milestone}`, d)}</td>
      <td className="px-4 py-3">
        <Badge color="indigo" className="w-fit">
          {tr(`sources.${source}`, d)}
        </Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {when(m.proposedAt, lang)}
      </td>
      <td className="px-4 py-3">
        {canConfirm && (
          <div className="flex gap-2">
            <Button
              size="xs"
              color="blue"
              disabled={busy}
              onClick={() => act(() => confirmMilestone(m))}
            >
              {tr("confirm", d)}
            </Button>
            <Button
              size="xs"
              color="light"
              disabled={busy}
              onClick={() => act(() => rejectMilestone(m, null))}
            >
              {tr("reject", d)}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * Departures, arrivals and closures a detection (GPS, ETA) left pending: a
 * person confirms them at the detected time or rejects them as a false positive.
 */
export default function PendingPanel({
  d,
  lang,
}: Readonly<{ d: I18nRecord; lang: string }>) {
  const { data, error, isLoading } = usePendingMilestones();
  const canConfirm = useTripsPermission(MILESTONE_CONFIRM);
  const [failure, setFailure] = useState<string | null>(null);
  const pending = data ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr("title", d)}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("description", d)}
          </p>
        </div>
        {pending.length > 0 && (
          <Badge color="warning" className="self-start">
            {tr("count", d, { count: String(pending.length) })}
          </Badge>
        )}
      </div>

      {isLoading && <p className="text-sm text-gray-500">{tr("loading", d)}</p>}
      {(error || failure) && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {failure ?? error?.message}
        </p>
      )}
      {data && pending.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center dark:border-gray-700">
          <HiOutlineCheckCircle className="h-6 w-6 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("empty", d)}
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">{tr("service", d)}</th>
                <th className="px-4 py-3">{tr("milestone", d)}</th>
                <th className="px-4 py-3">{tr("source", d)}</th>
                <th className="px-4 py-3">{tr("detectedAt", d)}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <PendingRow
                  key={`${p.milestone.tripId}-${p.milestone.milestone}`}
                  p={p}
                  canConfirm={canConfirm}
                  lang={lang}
                  d={d}
                  onError={setFailure}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

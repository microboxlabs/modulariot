"use client";

import { useState } from "react";
import { Button, TextInput } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { TripMilestone } from "../milestones/milestones-api";
import { shortTime } from "../board/trip-card";
import { confirm, reject } from "./sheet-api";

const STATUS_STYLE: Record<TripMilestone["status"], string> = {
  open: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  confirmed:
    "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

/** `datetime-local` value for now, in the browser's time zone. */
function localNow() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function Detail({
  m,
  planned,
  d,
  lang,
}: Readonly<{
  m: TripMilestone;
  planned: string | null;
  d: I18nRecord;
  lang: string;
}>) {
  const rows: [string, string | null][] = [
    ["sheet.planned", shortTime(planned, lang)],
    [
      "sheet.detected",
      m.proposedAt
        ? `${shortTime(m.proposedAt, lang)} · ${m.source ?? "—"}`
        : null,
    ],
    [
      "sheet.confirmed",
      m.confirmedAt
        ? `${shortTime(m.confirmedAt, lang)} · ${trDynamic(`sheet.channels.${m.channel ?? "api"}`, d)}`
        : null,
    ],
  ];
  return (
    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt className="text-gray-500 dark:text-gray-400">
            {trDynamic(key, d)}
          </dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">
            {value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One milestone: what was planned, detected and confirmed, and the actions a person with the permission has. */
export function MilestoneRow({
  m,
  planned,
  canConfirm,
  d,
  lang,
}: Readonly<{
  m: TripMilestone;
  planned: string | null;
  canConfirm: boolean;
  d: I18nRecord;
  lang: string;
}>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(localNow);
  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const record = () => act(() => confirm(m, new Date(at).toISOString()));
  const accept = () => act(() => confirm(m, null));
  const decline = () => act(() => reject(m, null));
  const recordable =
    canConfirm && (m.status === "open" || m.status === "rejected");

  return (
    <div className="border-t border-gray-100 py-3 first:border-t-0 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {trDynamic(`milestone.${m.milestone}`, d)}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status]}`}
        >
          {trDynamic(`milestoneStatus.${m.status}`, d)}
        </span>
      </div>
      <Detail m={m} planned={planned} d={d} lang={lang} />
      {canConfirm && m.status === "pending" && (
        <div className="mt-2 flex gap-2">
          <Button size="xs" color="blue" disabled={busy} onClick={accept}>
            {tr("sheet.confirm", d)}
          </Button>
          <Button size="xs" color="light" disabled={busy} onClick={decline}>
            {tr("sheet.reject", d)}
          </Button>
        </div>
      )}
      {recordable && (
        <div className="mt-2 flex items-center gap-2">
          <TextInput
            type="datetime-local"
            sizing="sm"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            aria-label={tr("sheet.recordAt", d)}
          />
          <Button
            size="xs"
            color="light"
            disabled={busy || !at}
            onClick={record}
          >
            {tr("sheet.record", d)}
          </Button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

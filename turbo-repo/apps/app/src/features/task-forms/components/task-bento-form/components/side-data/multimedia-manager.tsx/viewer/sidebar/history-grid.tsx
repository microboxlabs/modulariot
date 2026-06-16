import type { ReactNode } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { AlfrescoFileEntry } from "../../image.types";

type HistoryGridProps = Readonly<{
  entry: AlfrescoFileEntry["entry"];
  reviewStatusLabel: string | null;
  dictionary: I18nRecord;
}>;

const muted = "text-gray-400 dark:text-gray-500";

function ValueBadge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
      {children}
    </span>
  );
}

function StatusBadge({ status, label }: Readonly<{ status: string; label: string }>) {
  const colors =
    status === "APPROVED"
      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}

function HistoryRow({
  label,
  primary,
  secondary,
}: Readonly<{ label?: string; primary?: ReactNode; secondary?: ReactNode }>) {
  if (primary == null && secondary == null) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {label && <dt className="shrink-0"><ValueBadge>{label}</ValueBadge></dt>}
      {primary != null && <dd className="m-0 text-xs flex flex-wrap items-center gap-1">{primary}</dd>}
      {secondary != null && <dd className="m-0 text-xs flex flex-wrap items-center gap-1">{secondary}</dd>}
    </div>
  );
}

function buildPersonDateLine(
  person: string,
  date: string,
  byWord: string,
  onWord: string,
): ReactNode {
  return (
    <>
      <span className={muted}>{byWord}</span>
      <ValueBadge>{person}</ValueBadge>
      <span className={muted}>{onWord}</span>
      <ValueBadge>{date}</ValueBadge>
    </>
  );
}

function buildActivityLine(
  displayName: string | undefined,
  date: string | undefined,
  byWord: string,
  onWord: string,
): ReactNode {
  if (displayName && date) {
    return buildPersonDateLine(displayName, formatDateString(date), byWord, onWord);
  }
  if (displayName) {
    return <ValueBadge>{displayName}</ValueBadge>;
  }
  if (date) {
    return <ValueBadge>{formatDateString(date)}</ValueBadge>;
  }
  return null;
}

function buildStateSummary(
  statusLabel: string,
  reviewStatus: string,
  reviewedBy: string | undefined,
  reviewedAt: string | undefined,
  dictionary: I18nRecord,
): ReactNode {
  const byWord = tr("bento.multimedia.sidebar_history_state_by_word", dictionary);
  const onWord = tr("bento.multimedia.sidebar_history_state_on_word", dictionary);
  const statusBadge = <StatusBadge status={reviewStatus} label={statusLabel} />;

  if (reviewedBy && reviewedAt) {
    return (
      <>
        {statusBadge}
        <span className={muted}>{byWord}</span>
        <ValueBadge>{reviewedBy}</ValueBadge>
        <span className={muted}>{onWord}</span>
        <ValueBadge>{formatDateString(reviewedAt)}</ValueBadge>
      </>
    );
  }
  if (reviewedBy) {
    return (
      <>
        {statusBadge}
        <span className={muted}>{byWord}</span>
        <ValueBadge>{reviewedBy}</ValueBadge>
      </>
    );
  }
  return statusBadge;
}

export function HistoryGrid({ entry, reviewStatusLabel, dictionary }: HistoryGridProps) {
  const byWord = tr("bento.multimedia.sidebar_history_state_by_word", dictionary);
  const onWord = tr("bento.multimedia.sidebar_history_state_on_word", dictionary);
  const reviewStatus = entry.properties?.["mintral:reviewStatus"];
  const reviewedBy = entry.properties?.["mintral:reviewedBy"];
  const reviewedAt = entry.properties?.["mintral:reviewedAt"];

  const creationLine = buildActivityLine(entry.createdByUser?.displayName, entry.createdAt, byWord, onWord);
  const modificationLine = buildActivityLine(entry.modifiedByUser?.displayName, entry.modifiedAt, byWord, onWord);

  const stateSummary =
    reviewStatusLabel && reviewStatus
      ? buildStateSummary(reviewStatusLabel, reviewStatus, reviewedBy, reviewedAt, dictionary)
      : null;

  return (
    <dl className="flex flex-col gap-3">
      <HistoryRow
        label={tr("bento.multimedia.sidebar_history_creation", dictionary)}
        primary={creationLine}
      />
      <HistoryRow
        label={tr("bento.multimedia.sidebar_history_modification", dictionary)}
        primary={modificationLine}
      />
      {(stateSummary != null || reviewedBy) && (
        <HistoryRow
          primary={stateSummary ?? (reviewedBy ? <ValueBadge>{reviewedBy}</ValueBadge> : null)}
        />
      )}
    </dl>
  );
}

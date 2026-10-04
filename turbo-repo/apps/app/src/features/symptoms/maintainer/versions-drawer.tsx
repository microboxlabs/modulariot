"use client";

import { SettingsDrawerShell } from "@/features/common/components/settings-drawer/settings-drawer-shell";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { Change, SymptomVersion } from "./maintainer-api";
import { BumpBadge } from "./ui/badges";

const linkClass = "text-blue-600 hover:underline dark:text-blue-400";

function VersionItem({
  version,
  changes,
  current,
  canWrite,
  d,
  onView,
  onRollback,
  onFork,
}: Readonly<{
  version: SymptomVersion & { version: string };
  changes: Change[];
  current: string | null;
  canWrite: boolean;
  d: I18nRecord;
  onView: (version: string) => void;
  onRollback: (version: string) => void;
  onFork: (version: string) => void;
}>) {
  const inForce = version.version === current;
  return (
    <li
      className={`border-l-2 pb-4 pl-3 ${inForce ? "border-blue-500" : "border-gray-300 dark:border-gray-600"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <b className="font-mono">{version.version}</b>
        {version.bump && <BumpBadge bump={version.bump} d={d} />}
        <span className="text-xs text-gray-500">
          {version.publishedAt
            ? new Date(version.publishedAt).toLocaleString()
            : ""}
          {version.publishedBy ? ` · ${version.publishedBy}` : ""}
        </span>
        {inForce && (
          <span className="rounded bg-blue-100 px-1.5 text-[11px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {tr("inForce", d)}
          </span>
        )}
      </div>
      {version.reason && <p className="mt-0.5 text-sm">{version.reason}</p>}
      {changes.length > 0 && (
        <ul className="ml-4 mt-1 list-disc text-xs text-gray-500">
          {changes.map((c) => (
            <li key={`${c.section}-${c.text}`}>{c.text}</li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
        {!inForce && (
          <button
            type="button"
            className={linkClass}
            onClick={() => onView(version.version)}
          >
            {tr("openAndCompare", d)}
          </button>
        )}
        {canWrite && !inForce && (
          <button
            type="button"
            className={linkClass}
            onClick={() => onRollback(version.version)}
          >
            {tr("revertToThis", d)}
          </button>
        )}
        {canWrite && (
          <button
            type="button"
            className={linkClass}
            onClick={() => onFork(version.version)}
          >
            {tr("duplicate", d)}
          </button>
        )}
      </div>
    </li>
  );
}

/** The published versions, newest first, as in the prototype's Versiones drawer. */
export default function VersionsDrawer({
  show,
  versions,
  changes,
  current,
  canWrite,
  d,
  onClose,
  onView,
  onRollback,
  onFork,
}: Readonly<{
  show: boolean;
  versions: SymptomVersion[];
  changes: Record<string, Change[]>;
  current: string | null;
  canWrite: boolean;
  d: I18nRecord;
  onClose: () => void;
  onView: (version: string) => void;
  onRollback: (version: string) => void;
  onFork: (version: string) => void;
}>) {
  const published = versions.filter(
    (v): v is SymptomVersion & { version: string } => v.version !== null
  );
  return (
    <SettingsDrawerShell
      show={show}
      onClose={onClose}
      title={tr("sectionVersions", d)}
      closeLabel={tr("close", d)}
    >
      <div className="flex-1 overflow-auto p-5 text-sm text-gray-700 dark:text-gray-200">
        <p className="mb-4 text-xs text-gray-500">{tr("versionsHelp", d)}</p>
        {published.length === 0 ? (
          <p className="text-xs text-gray-500">{tr("unpublished", d)}</p>
        ) : (
          <ol>
            {published.map((v) => (
              <VersionItem
                key={v.id}
                version={v}
                changes={changes[v.version] ?? []}
                current={current}
                canWrite={canWrite}
                d={d}
                onView={onView}
                onRollback={onRollback}
                onFork={onFork}
              />
            ))}
          </ol>
        )}
      </div>
    </SettingsDrawerShell>
  );
}

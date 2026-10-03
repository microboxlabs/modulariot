"use client";

import { Button } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { BumpBadge } from "./ui/badges";
import { useVersionCompare } from "./maintainer-api";

function Changes({
  id,
  version,
  current,
  d,
}: Readonly<{
  id: string;
  version: string;
  current: string | null;
  d: I18nRecord;
}>) {
  const { data, error } = useVersionCompare(id, version, current);
  if (!current) return null;
  if (error) {
    return (
      <p className="text-xs text-red-600 dark:text-red-400">
        {tr("compareFailed", d)}
      </p>
    );
  }
  if (!data) return null;
  if (data.length === 0) {
    return (
      <p className="text-xs">
        {tr("noChangesToCurrent", d, { version: current })}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span>{tr("changesToCurrent", d, { version: current })}</span>
      <ul className="flex flex-col gap-0.5">
        {data.map((c) => (
          <li
            key={`${c.section}-${c.text}`}
            className="flex items-center gap-2"
          >
            <BumpBadge bump={c.bump} d={d} />
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shown above the sheet while an old version is open: read only, what changed since, and what to do with it. */
export default function VersionBanner({
  id,
  version,
  current,
  canWrite,
  d,
  onRevert,
  onDuplicate,
  onBack,
}: Readonly<{
  id: string;
  version: string;
  current: string | null;
  canWrite: boolean;
  d: I18nRecord;
  onRevert: () => void;
  onDuplicate: () => void;
  onBack: () => void;
}>) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          {tr("viewingVersion", d, { version })}
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          {canWrite && (
            <>
              <Button size="xs" color="alternative" onClick={onRevert}>
                {tr("revertHere", d)}
              </Button>
              <Button size="xs" color="alternative" onClick={onDuplicate}>
                {tr("duplicateHere", d)}
              </Button>
            </>
          )}
          <Button size="xs" onClick={onBack}>
            {tr("backToCurrent", d)}
          </Button>
        </span>
      </div>
      <Changes id={id} version={version} current={current} d={d} />
    </div>
  );
}

"use client";

import { SettingsDrawerShell } from "@/features/common/components/settings-drawer/settings-drawer-shell";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { BumpBadge } from "@/features/symptoms/maintainer/ui/badges";
import type { RuleSpec, RuleVersion } from "./conversations-types";
import { normalizeSpec, ruleChanges, type RuleChange } from "./rule-model";

const linkClass = "text-blue-600 hover:underline dark:text-blue-400";

/** The published versions, newest first, each with what changed from the one before. */
export function versionHistory(
  versions: RuleVersion[],
  d: I18nRecord
): { version: RuleVersion & { version: string }; changes: RuleChange[] }[] {
  const published = versions
    .filter((v): v is RuleVersion & { version: string } => v.version !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return published.map((v, i) => {
    const before = published[i + 1];
    return {
      version: v,
      changes: ruleChanges(
        normalizeSpec(v.spec),
        before ? normalizeSpec(before.spec) : null,
        d
      ),
    };
  });
}

/** Versiones e historial: each publication, and a way back to one as the draft. */
export default function RuleVersionsDrawer({
  show,
  versions,
  current,
  canWrite,
  d,
  onClose,
  onRestore,
}: Readonly<{
  show: boolean;
  versions: RuleVersion[];
  current: string | null;
  canWrite: boolean;
  d: I18nRecord;
  onClose: () => void;
  /** Copies a version's spec into the draft. */
  onRestore: (spec: RuleSpec) => void;
}>) {
  const history = versionHistory(versions, d);
  return (
    <SettingsDrawerShell
      show={show}
      onClose={onClose}
      title={tr("sectionVersions", d)}
      closeLabel={tr("close", d)}
    >
      <div className="flex-1 overflow-auto p-5 text-sm text-gray-700 dark:text-gray-200">
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          {tr("versionsHelp", d)}
        </p>
        {history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("unpublished", d)}
          </p>
        ) : (
          <ol>
            {history.map(({ version: v, changes }) => {
              const inForce = v.version === current;
              return (
                <li
                  key={v.id}
                  className={`border-l-2 pb-4 pl-3 ${inForce ? "border-blue-500" : "border-gray-300 dark:border-gray-600"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="font-mono">{v.version}</b>
                    {v.bump && <BumpBadge bump={v.bump} d={d} />}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(v.createdAt).toLocaleString()}
                      {v.createdBy ? ` · ${v.createdBy}` : ""}
                    </span>
                    {inForce && (
                      <span className="rounded bg-blue-100 px-1.5 text-[11px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {tr("inForce", d)}
                      </span>
                    )}
                  </div>
                  {v.reason && <p className="mt-0.5 text-sm">{v.reason}</p>}
                  {changes.length > 0 && (
                    <ul className="mt-1 ml-4 list-disc text-xs text-gray-500 dark:text-gray-400">
                      {changes.map((c) => (
                        <li key={c.key}>{c.text}</li>
                      ))}
                    </ul>
                  )}
                  {canWrite && !inForce && (
                    <button
                      type="button"
                      className={`mt-1.5 text-xs ${linkClass}`}
                      onClick={() => onRestore(normalizeSpec(v.spec))}
                    >
                      {tr("revertToThis", d)}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </SettingsDrawerShell>
  );
}

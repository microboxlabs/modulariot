"use client";

import { useState } from "react";
import { HiChevronRight } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { VersionGroup } from "./review-version";
import { StateChangeEntry } from "./state-change-entry";

/**
 * Decisions taken against revisions this content has since replaced.
 *
 * Kept out of the panel proper and behind a disclosure. A rejection explains bytes nobody can
 * see any more, so presenting it beside the live review reads as a verdict on the photo on
 * screen — but deleting it from view would lose the only record of why the driver was asked to
 * re-send. Collapsed by default: the reviewer's job is the revision in front of them.
 *
 * Read-only throughout: no handlers are passed, so no card offers a control. Every entry here
 * is a review round, which the repository stores as the decision itself and gives no endpoint
 * to edit — the same reason the live panel withholds those controls from round observations.
 */
export function VersionHistory({
  groups,
  dictionary,
}: Readonly<{
  groups: VersionGroup[];
  dictionary: I18nRecord;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  if (groups.length === 0) return null;

  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 w-full text-left text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer py-1"
      >
        <HiChevronRight
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
        {tr("bento.multimedia.sidebar_obs_history_title", dictionary)} ({total})
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 pl-1">
          {groups.map((group) => (
            <div key={group.version ?? "unversioned"} className="flex flex-col gap-2">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                {group.version
                  ? tr("bento.multimedia.sidebar_obs_history_version", dictionary, {
                      version: group.version,
                    })
                  : tr("bento.multimedia.sidebar_obs_history_unversioned", dictionary)}
              </span>
              {/* Newest decision first, as the live panel above orders its own. */}
              {[...group.entries].reverse().map((entry) =>
                entry.kind === "state_change" ? (
                  <StateChangeEntry key={entry.id} entry={entry} dictionary={dictionary} />
                ) : null
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

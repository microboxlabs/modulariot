"use client";

import { Fragment, useState } from "react";
import { HiChevronRight } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { StateChangeTimelineEntry } from "./observation.types";
import { observationTypeLabel } from "./observation-utils";
import type { VersionGroup } from "./review-version";

const VERDICT = {
  approved: {
    dot: "bg-green-500",
    label: "text-green-700 dark:text-green-400",
    key: "bento.multimedia.sidebar_obs_state_approved",
  },
  rejected: {
    dot: "bg-red-500",
    label: "text-red-700 dark:text-red-400",
    key: "bento.multimedia.sidebar_obs_state_rejected",
  },
  pending: {
    dot: "bg-amber-500",
    label: "text-amber-700 dark:text-amber-400",
    key: "bento.multimedia.sidebar_obs_state_pending",
  },
} as const;

const muted = "text-xs text-gray-400 dark:text-gray-500";

/**
 * One decision, as a point on the rail.
 *
 * Deliberately not an ObservationCard. History is read past-tense and several entries at a
 * time, and a card each stacked four bordered boxes down a narrow column for what is really
 * four lines of text. The dot carries the verdict, which frees the reasons and the comment to
 * be plain prose underneath it.
 *
 * A decision nobody wrote anything on renders as its line alone. The live panel says "sin notas
 * adjuntas" in that spot, which earns its room when you are being asked to act on the thing; in
 * a list of matters already settled it is four words of nothing, repeated.
 */
function DecisionPoint({
  entry,
  dictionary,
}: Readonly<{ entry: StateChangeTimelineEntry; dictionary: I18nRecord }>) {
  const style = VERDICT[entry.status];
  return (
    <li className="relative">
      <span className={`absolute -left-5 top-1.5 h-2 w-2 rounded-full ${style.dot}`} />
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`text-xs font-semibold ${style.label}`}>
          {tr(style.key, dictionary)}
        </span>
        <span className={muted}>{formatDateString(entry.committedAt.toISOString())}</span>
        {entry.committedBy && (
          <span className={`${muted} truncate max-w-28`} title={entry.committedBy}>
            · {entry.committedBy}
          </span>
        )}
      </div>
      {entry.observations.map((obs) => (
        <div key={obs.id} className="mt-0.5">
          {obs.types.length > 0 && (
            // Middots rather than chips: a chip is a box, and these are read, not clicked.
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {obs.types.map((type) => observationTypeLabel(type, dictionary)).join(" · ")}
            </p>
          )}
          {obs.description && (
            <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">
              {obs.description}
            </p>
          )}
        </div>
      ))}
    </li>
  );
}

/**
 * Decisions taken against revisions this content has since replaced.
 *
 * Kept out of the panel proper and behind a disclosure. A rejection explains bytes nobody can
 * see any more, so presenting it beside the live review reads as a verdict on the photo on
 * screen — but deleting it from view would lose the only record of why the driver was asked to
 * re-send. Collapsed by default: the reviewer's job is the revision in front of them.
 *
 * Read-only throughout — no handler reaches any of it. Every entry here is a review round,
 * which the repository stores as the decision itself and gives no endpoint to edit, the same
 * reason the live panel withholds those controls from round observations.
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
        // One rail for the whole history rather than one per revision, so the eye follows a
        // single line from the newest decision back to the first and the version labels read as
        // markers along it.
        <ol className="ml-1.5 pl-5 border-l border-gray-200 dark:border-gray-700 flex flex-col gap-3">
          {groups.map((group) => (
            <Fragment key={group.version ?? "unversioned"}>
              <li className="relative">
                {/* Hollow, so a revision marker never reads as a decision. */}
                <span className="absolute -left-5 top-1 h-2 w-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" />
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                  {group.version
                    ? tr("bento.multimedia.sidebar_obs_history_version", dictionary, {
                        version: group.version,
                      })
                    : tr("bento.multimedia.sidebar_obs_history_unversioned", dictionary)}
                </span>
              </li>
              {/* Newest decision first, as the live panel orders its own. */}
              {[...group.entries].reverse().map((entry) =>
                entry.kind === "state_change" ? (
                  <DecisionPoint key={entry.id} entry={entry} dictionary={dictionary} />
                ) : null
              )}
            </Fragment>
          ))}
        </ol>
      )}
    </div>
  );
}

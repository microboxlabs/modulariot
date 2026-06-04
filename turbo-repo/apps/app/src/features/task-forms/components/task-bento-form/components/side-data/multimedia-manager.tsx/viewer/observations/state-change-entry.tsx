"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { StateChangeTimelineEntry } from "./observation.types";
import { ObservationCard } from "./observation-card";

const STATE_CHANGE_STYLES = {
  approved: {
    border: "border-green-200 dark:border-green-800",
    header: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    label: "text-green-700 dark:text-green-300",
    key: "bento.multimedia.sidebar_obs_state_approved",
  },
  pending: {
    border: "border-amber-200 dark:border-amber-800",
    header: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    label: "text-amber-700 dark:text-amber-300",
    key: "bento.multimedia.sidebar_obs_state_pending",
  },
  rejected: {
    border: "border-red-200 dark:border-red-800",
    header: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    label: "text-red-700 dark:text-red-300",
    key: "bento.multimedia.sidebar_obs_state_rejected",
  },
} as const;

export function StateChangeEntry({
  entry,
  dictionary,
  onRemoveCommitted,
  onAddReply,
  onRemoveReply,
  pendingReplyRef,
}: Readonly<{
  entry: StateChangeTimelineEntry;
  dictionary: I18nRecord;
  onRemoveCommitted?: (id: string) => void;
  onAddReply?: (obsId: string, description: string) => void;
  onRemoveReply?: (obsId: string, replyId: string) => void;
  pendingReplyRef?: React.RefObject<{ text: string; send: () => void }>;
}>) {
  const style = STATE_CHANGE_STYLES[entry.status];
  return (
    <div className={`shrink-0 rounded-lg border overflow-hidden ${style.border}`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${style.header}`}>
        <span className={`text-xs font-semibold ${style.label}`}>
          {tr(style.key, dictionary)}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {formatDateString(entry.committedAt.toISOString())}
        </span>
        {entry.committedBy && (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-24" title={entry.committedBy}>
            · {entry.committedBy}
          </span>
        )}
      </div>
      {entry.observations.length > 0 ? (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {entry.observations.map((obs) => (
            <div key={obs.id} className="px-3 py-2.5">
              <ObservationCard
                obs={obs}
                dictionary={dictionary}
                onDelete={onRemoveCommitted ? () => onRemoveCommitted(obs.id) : undefined}
                onAddReply={onAddReply ? (desc) => onAddReply(obs.id, desc) : undefined}
                onRemoveReply={onRemoveReply ? (rid) => onRemoveReply(obs.id, rid) : undefined}
                pendingReplyRef={pendingReplyRef}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2.5 italic">
          {tr("bento.multimedia.sidebar_obs_none_in_container", dictionary)}
        </p>
      )}
    </div>
  );
}

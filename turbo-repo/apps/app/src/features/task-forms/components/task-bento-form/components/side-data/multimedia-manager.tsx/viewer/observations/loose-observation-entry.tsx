"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { LooseObservationTimelineEntry as LooseObsEntry } from "./observation.types";
import { ObservationCard } from "./observation-card";

export function LooseObservationEntry({
  entry,
  dictionary,
  onRemoveCommitted,
  onAddReply,
  onRemoveReply,
  pendingReplyRef,
}: Readonly<{
  entry: LooseObsEntry;
  dictionary: I18nRecord;
  onRemoveCommitted?: (id: string) => void;
  onAddReply?: (obsId: string, description: string) => void;
  onRemoveReply?: (obsId: string, replyId: string) => void;
  pendingReplyRef?: React.RefObject<{ text: string; send: () => void }>;
}>) {
  return (
    <div className="shrink-0 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      <ObservationCard
        obs={{ id: entry.id, types: entry.types, description: entry.description, createdAt: entry.createdAt, createdBy: entry.createdBy, replies: entry.replies }}
        dictionary={dictionary}
        onDelete={onRemoveCommitted ? () => onRemoveCommitted(entry.id) : undefined}
        onAddReply={onAddReply ? (desc) => onAddReply(entry.id, desc) : undefined}
        onRemoveReply={onRemoveReply ? (rid) => onRemoveReply(entry.id, rid) : undefined}
        pendingReplyRef={pendingReplyRef}
      />
    </div>
  );
}

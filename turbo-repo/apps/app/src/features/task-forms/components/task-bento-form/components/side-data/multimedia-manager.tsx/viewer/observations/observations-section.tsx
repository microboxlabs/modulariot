"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { ObservationType, ObservationEntry, TimelineEntry } from "./observation.types";
import { OBSERVATION_TYPE_KEYS } from "./observation.types";
import { ObservationCard } from "./observation-card";
import { StateChangeEntry } from "./state-change-entry";
import { LooseObservationEntry } from "./loose-observation-entry";

export function ObservationsSection({
  dictionary,
  draftObservations,
  committedTimeline,
  isInDraftReview,
  onAdd,
  onRemoveDraft,
  onRemoveCommitted,
  onAddReply,
  onRemoveReply,
  pendingReplyRef,
  mode = "full",
  onShowAll,
}: Readonly<{
  dictionary: I18nRecord;
  draftObservations: ObservationEntry[];
  committedTimeline: TimelineEntry[];
  isInDraftReview: boolean;
  onAdd: (type: ObservationType, description: string) => void;
  onRemoveDraft: (id: string) => void;
  onRemoveCommitted?: (id: string) => void;
  onAddReply?: (obsId: string, description: string) => void;
  onRemoveReply?: (obsId: string, replyId: string) => void;
  pendingReplyRef?: React.RefObject<{ text: string; send: () => void }>;
  mode?: "preview" | "full";
  onShowAll?: () => void;
}>) {
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<ObservationType>("value_not_visible");
  const [newDescription, setNewDescription] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingReplyRef || !isAdding) return;
    pendingReplyRef.current = {
      text: newDescription,
      send: () => { if (newDescription.trim()) { onAdd(newType, newDescription.trim()); } },
    };
    return () => { pendingReplyRef.current = { text: "", send: () => {} }; };
  }, [newDescription, isAdding, pendingReplyRef, onAdd, newType]);

  const handleAdd = () => {
    if (!newDescription.trim()) return;
    onAdd(newType, newDescription.trim());
    setNewDescription("");
    setNewType("value_not_visible");
    setIsAdding(false);
  };

  const allEntries = useMemo(() => [...committedTimeline].reverse(), [committedTimeline]);
  const hasContent = allEntries.length > 0 || draftObservations.length > 0;

  // Preview mode: show last 3 entries
  const PREVIEW_LIMIT = 3;
  const isPreview = mode === "preview";
  const displayEntries = isPreview ? allEntries.slice(0, PREVIEW_LIMIT) : allEntries.slice(0, visibleCount);
  const hasMore = isPreview ? allEntries.length > PREVIEW_LIMIT : visibleCount < allEntries.length;

  // Infinite scroll for full mode
  useEffect(() => {
    if (isPreview || !scrollSentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCount < allEntries.length) {
          setVisibleCount((prev) => Math.min(prev + 10, allEntries.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(scrollSentinelRef.current);
    return () => observer.disconnect();
  }, [isPreview, visibleCount, allEntries.length]);

  const renderEntry = (entry: TimelineEntry) => {
    if (entry.kind === "state_change") {
      return (
        <StateChangeEntry
          key={entry.id}
          entry={entry}
          dictionary={dictionary}
          onRemoveCommitted={onRemoveCommitted}
          onAddReply={onAddReply}
          onRemoveReply={onRemoveReply}
          pendingReplyRef={pendingReplyRef}
        />
      );
    }
    return (
      <LooseObservationEntry
        key={entry.id}
        entry={entry}
        dictionary={dictionary}
        onRemoveCommitted={onRemoveCommitted}
        onAddReply={onAddReply}
        onRemoveReply={onRemoveReply}
        pendingReplyRef={pendingReplyRef}
      />
    );
  };

  const showEmpty = !hasContent && !isAdding;

  return (
    <div className="flex flex-col gap-2">

      {/* New observation form — fixed at top */}
      {isAdding ? (
        <div className="flex-shrink-0 flex flex-col gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10 p-3">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as ObservationType)}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 cursor-pointer"
          >
            {OBSERVATION_TYPE_KEYS.map((key) => (
              <option key={key} value={key}>{tr(`bento.multimedia.obs_${key}`, dictionary)}</option>
            ))}
          </select>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder={tr("bento.multimedia.sidebar_obs_placeholder", dictionary)}
            rows={3}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setNewDescription(""); }}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              {tr("bento.multimedia.sidebar_obs_cancel", dictionary)}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newDescription.trim()}
              className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {tr("bento.multimedia.sidebar_obs_add_btn", dictionary)}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex-shrink-0 w-full text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 border border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 rounded-lg py-2 transition-colors cursor-pointer"
        >
          {tr("bento.multimedia.sidebar_obs_add", dictionary)}
        </button>
      )}

      {/* Timeline entries */}
      {hasContent && (
        <div className="flex flex-col gap-2">
          {displayEntries.map(renderEntry)}

          {/* Draft observations visible while in review */}
          {isInDraftReview && draftObservations.map((obs) => (
            <div key={obs.id} className="shrink-0 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30">
              <ObservationCard
                obs={obs}
                dictionary={dictionary}
                onDelete={() => onRemoveDraft(obs.id)}
                onAddReply={onAddReply ? (desc) => onAddReply(obs.id, desc) : undefined}
                onRemoveReply={onRemoveReply ? (rid) => onRemoveReply(obs.id, rid) : undefined}
                pendingReplyRef={pendingReplyRef}
              />
            </div>
          ))}

          {/* Preview: "Show all" button */}
          {isPreview && hasMore && (
            <button
              type="button"
              onClick={() => onShowAll?.()}
              className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium py-2 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
            >
              {tr("bento.multimedia.sidebar_obs_show_all", dictionary)} ({allEntries.length})
            </button>
          )}

          {/* Full mode: infinite scroll sentinel */}
          {!isPreview && hasMore && (
            <div ref={scrollSentinelRef} className="flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {showEmpty && (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-1 py-1">{tr("bento.multimedia.sidebar_obs_empty", dictionary)}</p>
      )}
    </div>
  );
}

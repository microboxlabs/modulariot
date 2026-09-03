"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HiCheck, HiMinus, HiSparkles, HiTrash } from "react-icons/hi2";
import { toast } from "sonner";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { getStories, removeStories } from "../storytelling-store";
import type { StoryItem } from "../storytelling.types";
import { StoryDeleteDialog } from "./story-delete-dialog";
import StoryDetailsModal from "./story-details-modal";
import StoryGrid from "./story-grid";
import StoryShareModal from "./story-share-modal";

interface StorytellingPageContentProps {
  /** `storytelling` dict namespace — its own `breadcrumb` subtree included. */
  readonly dict: I18nRecord;
  /** Root dictionary — SectionHeader's bottom filter bar translates from it. */
  readonly rootDict: I18nRecord;
}

export default function StorytellingPageContent({
  dict,
  rootDict,
}: StorytellingPageContentProps) {
  const { lang } = useParams<{ lang: string }>();
  const searchParams = useSearchParams();
  const breadcrumbDict = (dict?.breadcrumb as I18nRecord) ?? {};

  // Local, mutable copy backed by localStorage (storytelling-store): this is
  // frontend-only, so delete needs somewhere to actually remove the card
  // from, and a fresh mount picks up anything the chat's create_story
  // trigger has added since the last visit.
  const [stories, setStories] = useState<StoryItem[]>(() => getStories());
  const [sharing, setSharing] = useState<StoryItem | null>(null);
  const [detailing, setDetailing] = useState<StoryItem | null>(null);
  // Single delete (per-card kebab menu) and mass delete (selection toolbar)
  // both just populate this with the stories to confirm — the dialog itself
  // doesn't care which triggered it.
  const [deleting, setDeleting] = useState<readonly StoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  // URL-driven filters from the breadcrumb's own filter bar (see
  // navegation_params.ts's `storytelling` entry), same pattern as fleet-management.
  const nameFilter = (searchParams.get("name") ?? "").trim().toLowerCase();
  const typeFilter = (searchParams.get("artifactType") ?? "").split(",").filter(Boolean);
  const creatorFilter = (searchParams.get("creator") ?? "").split(",").filter(Boolean);
  const createdFrom = searchParams.get("createdAt_from") ?? "";
  const createdTo = searchParams.get("createdAt_to") ?? "";

  const hasActiveFilters =
    nameFilter !== "" ||
    typeFilter.length > 0 ||
    creatorFilter.length > 0 ||
    createdFrom !== "" ||
    createdTo !== "";

  // Comma-joined so the memo key stays a primitive — the arrays are rebuilt
  // every render from the URL.
  const typeKey = typeFilter.join(",");
  const creatorKey = creatorFilter.join(",");

  const visible = useMemo(() => {
    return stories.filter((story) => {
      if (nameFilter && !story.title.toLowerCase().includes(nameFilter)) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(story.artifactType)) return false;
      if (creatorFilter.length > 0 && !creatorFilter.includes(story.createdBy)) return false;
      if (createdFrom && story.createdAt < createdFrom) return false;
      if (createdTo && story.createdAt > createdTo) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, nameFilter, typeKey, creatorKey, createdFrom, createdTo]);

  // "Select all" only ever acts on what's actually on screen — filtering to
  // a name match and hitting it shouldn't reach out and select stories the
  // filter is hiding.
  const allVisibleSelected =
    visible.length > 0 && visible.every((story) => selectedIds.has(story.id));
  const someVisibleSelected = visible.some((story) => selectedIds.has(story.id));

  function toggleSelect(story: StoryItem) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(story.id)) next.delete(story.id);
      else next.add(story.id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      // Any visible selection at all — full or partial — collapses back to
      // none; only a fully-empty visible selection expands to everything.
      if (someVisibleSelected) {
        for (const story of visible) next.delete(story.id);
      } else {
        for (const story of visible) next.add(story.id);
      }
      return next;
    });
  }

  function handleDeleteConfirm() {
    if (deleting.length === 0) return;
    const ids = deleting.map((s) => s.id);
    removeStories(ids);
    setStories((prev) => prev.filter((s) => !ids.includes(s.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    toast.success(
      deleting.length === 1 && deleting[0]
        ? tr("toast.deleted", dict, { name: deleting[0].title })
        : tr("toast.deletedMultiple", dict, { count: String(deleting.length) })
    );
    setDeleting([]);
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Same shared header the kanban views (planning/shipping/delivery/finished)
          use: breadcrumb on top, its filter bar underneath — registered in
          navegation_params.ts under the "storytelling" key. */}
      <SectionHeader
        path={["storytelling"]}
        lang={lang}
        rootIcon={<HiSparkles className="mr-2 h-4 w-4" />}
        breadcrumbDict={breadcrumbDict}
        filterDict={rootDict}
      />

      <div className="mx-auto flex w-full max-w-screen-2xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-6 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {tr("title", dict)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("description", dict)}
            </p>
          </div>

          {/* "Select all" is always here once there's anything to select —
              it's the only way to select more than one card without hovering
              each one individually. Clicking it again while anything visible
              is selected clears the selection instead of a separate X
              button. The count/delete cluster next to it only shows up once
              the selection is non-empty. */}
          {visible.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg py-0.5 pr-1.5 pl-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    allVisibleSelected || someVisibleSelected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 dark:border-gray-500"
                  }`}
                >
                  {allVisibleSelected && <HiCheck className="h-3 w-3" />}
                  {someVisibleSelected && !allVisibleSelected && <HiMinus className="h-3 w-3" />}
                </span>
                {tr("selection.selectAll", dict)}
              </button>

              {selectedIds.size > 0 && (
                <>
                  <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {tr("selection.count", dict, { count: String(selectedIds.size) })}
                  </span>
                  <button
                    type="button"
                    aria-label={tr("selection.deleteSelected", dict)}
                    title={tr("selection.deleteSelected", dict)}
                    onClick={() =>
                      setDeleting(stories.filter((story) => selectedIds.has(story.id)))
                    }
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <HiTrash className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <StoryGrid
          stories={visible}
          lang={lang}
          dict={dict}
          emptyMessage={
            hasActiveFilters ? tr("filters.noMatches", dict) : tr("list.empty", dict)
          }
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onShare={setSharing}
          onDetails={setDetailing}
          onDelete={(story) => setDeleting([story])}
        />
      </div>

      <StoryShareModal
        story={sharing}
        lang={lang}
        onClose={() => setSharing(null)}
        dict={dict}
      />

      <StoryDetailsModal
        story={detailing}
        lang={lang}
        onClose={() => setDetailing(null)}
        dict={dict}
      />

      <StoryDeleteDialog
        stories={deleting}
        onClose={() => setDeleting([])}
        onConfirm={handleDeleteConfirm}
        dict={dict}
      />
    </div>
  );
}

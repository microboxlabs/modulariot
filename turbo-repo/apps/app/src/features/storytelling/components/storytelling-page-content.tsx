"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HiCheck, HiMinus, HiSparkles, HiTrash } from "react-icons/hi2";
import { toast } from "sonner";
import { useHarnessChatContext } from "@/features/harness-chat/context/harness-chat-context";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { deleteStory, listStories, updateStory } from "../stories-api";
import type { Story, StoryKind } from "../storytelling.types";

/** The most stories the API returns in one list. */
const LIST_LIMIT = 200;
import { StoryDeleteDialog } from "./story-delete-dialog";
import StoryDetailsModal from "./story-details-modal";
import StoryGrid from "./story-grid";
import { StoryRenameDialog } from "./story-rename-dialog";

interface StorytellingPageContentProps {
  /** `storytelling` dict namespace — its own `breadcrumb` subtree included. */
  readonly dict: I18nRecord;
  /** Root dictionary — SectionHeader's bottom filter bar translates from it. */
  readonly rootDict: I18nRecord;
}

type ListState =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly stories: readonly Story[] };

export default function StorytellingPageContent({
  dict,
  rootDict,
}: StorytellingPageContentProps) {
  const { lang } = useParams<{ lang: string }>();
  const searchParams = useSearchParams();
  const { open: openChat } = useHarnessChatContext();
  const breadcrumbDict = (dict?.breadcrumb as I18nRecord) ?? {};

  const [state, setState] = useState<ListState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [detailing, setDetailing] = useState<Story | null>(null);
  const [renaming, setRenaming] = useState<Story | null>(null);
  // Single delete (per-card menu) and mass delete (selection toolbar) both
  // fill this with the stories to confirm.
  const [deleting, setDeleting] = useState<readonly Story[]>([]);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    new Set()
  );

  // URL-driven filters from the breadcrumb's filter bar (navegation_params.ts,
  // `storytelling`). The name goes to the server; the rest filter locally.
  const nameFilter = (searchParams.get("name") ?? "").trim();
  const kindFilter = (searchParams.get("artifactType") ?? "")
    .split(",")
    .filter(Boolean);
  const createdFrom = searchParams.get("createdAt_from") ?? "";
  const createdTo = searchParams.get("createdAt_to") ?? "";
  const hasActiveFilters =
    nameFilter !== "" ||
    kindFilter.length > 0 ||
    createdFrom !== "" ||
    createdTo !== "";
  const kindKey = kindFilter.join(",");

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    // One kind filters upstream; several are filtered here from the
    // largest page the API serves.
    const kinds = kindKey ? kindKey.split(",") : [];
    const kind = kinds.length === 1 ? (kinds[0] as StoryKind) : undefined;
    listStories({ search: nameFilter, kind, limit: LIST_LIMIT })
      .then((stories) => {
        if (!cancelled) setState({ status: "ready", stories });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [nameFilter, kindKey, reload]);

  const stories = useMemo(
    () => (state.status === "ready" ? state.stories : []),
    [state]
  );

  const visible = useMemo(() => {
    const kinds = kindKey ? kindKey.split(",") : [];
    return stories.filter((story) => {
      const created = story.createdAt.slice(0, 10);
      if (kinds.length > 0 && !kinds.includes(story.kind)) return false;
      if (createdFrom && created < createdFrom) return false;
      if (createdTo && created > createdTo) return false;
      return true;
    });
  }, [stories, kindKey, createdFrom, createdTo]);

  const selectable = visible.filter((story) => story.owned);
  const allVisibleSelected =
    selectable.length > 0 &&
    selectable.every((story) => selectedIds.has(story.id));
  const someVisibleSelected = selectable.some((story) =>
    selectedIds.has(story.id)
  );

  const replaceStory = useCallback((next: Story) => {
    setState((prev) =>
      prev.status === "ready"
        ? {
            ...prev,
            stories: prev.stories.map((s) => (s.id === next.id ? next : s)),
          }
        : prev
    );
  }, []);

  function toggleSelect(story: Story) {
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
      for (const story of selectable) {
        if (someVisibleSelected) next.delete(story.id);
        else next.add(story.id);
      }
      return next;
    });
  }

  async function handleDeleteConfirm() {
    const targets = deleting;
    if (targets.length === 0) return;
    setDeleting([]);
    const results = await Promise.allSettled(
      targets.map((story) => deleteStory(story.id))
    );
    const removed = new Set(
      targets
        .filter((_, i) => results[i].status === "fulfilled")
        .map((s) => s.id)
    );
    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, stories: prev.stories.filter((s) => !removed.has(s.id)) }
        : prev
    );
    setSelectedIds(
      (prev) => new Set([...prev].filter((id) => !removed.has(id)))
    );
    if (removed.size < targets.length) toast.error(tr("toast.failed", dict));
    if (removed.size === 1 && targets.length === 1) {
      toast.success(tr("toast.deleted", dict, { name: targets[0].title }));
    } else if (removed.size > 0) {
      toast.success(
        tr("toast.deletedMultiple", dict, { count: String(removed.size) })
      );
    }
  }

  async function handleRename(title: string) {
    const story = renaming;
    setRenaming(null);
    if (!story) return;
    try {
      const saved = await updateStory(story.id, { title });
      replaceStory({
        ...story,
        title: saved.title,
        updatedBy: saved.updatedBy,
        updatedAt: saved.updatedAt,
      });
    } catch {
      toast.error(tr("toast.failed", dict));
    }
  }

  let body;
  if (state.status === "loading") {
    body = (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400" />
      </div>
    );
  } else if (state.status === "failed") {
    body = (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("list.loadFailed", dict)}
        </p>
        <button
          type="button"
          onClick={() => setReload((n) => n + 1)}
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {tr("list.retry", dict)}
        </button>
      </div>
    );
  } else {
    body = (
      <StoryGrid
        stories={visible}
        lang={lang}
        dict={dict}
        empty={
          hasActiveFilters ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("filters.noMatches", dict)}
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {tr("list.empty", dict)}
              </p>
              <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
                {tr("list.emptyHint", dict)}
              </p>
              <button
                type="button"
                onClick={openChat}
                className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {tr("list.openChat", dict)}
              </button>
            </>
          )
        }
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onDetails={setDetailing}
        onRename={setRenaming}
        onDelete={(story) => setDeleting([story])}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
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

          {selectable.length > 0 && (
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
                  {someVisibleSelected && !allVisibleSelected && (
                    <HiMinus className="h-3 w-3" />
                  )}
                </span>
                {tr("selection.selectAll", dict)}
              </button>

              {selectedIds.size > 0 && (
                <>
                  <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {tr("selection.count", dict, {
                      count: String(selectedIds.size),
                    })}
                  </span>
                  <button
                    type="button"
                    aria-label={tr("selection.deleteSelected", dict)}
                    title={tr("selection.deleteSelected", dict)}
                    onClick={() =>
                      setDeleting(
                        stories.filter((story) => selectedIds.has(story.id))
                      )
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

        {body}
      </div>

      <StoryDetailsModal
        story={detailing}
        lang={lang}
        onClose={() => setDetailing(null)}
        dict={dict}
      />

      <StoryRenameDialog
        story={renaming}
        onClose={() => setRenaming(null)}
        onConfirm={(title) => void handleRename(title)}
        dict={dict}
      />

      <StoryDeleteDialog
        stories={deleting}
        onClose={() => setDeleting([])}
        onConfirm={() => void handleDeleteConfirm()}
        dict={dict}
      />
    </div>
  );
}

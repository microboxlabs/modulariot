"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HiSparkles } from "react-icons/hi2";
import { toast } from "sonner";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { getStories, removeStory } from "../storytelling-store";
import type { StoryItem } from "../storytelling.types";
import { StoryDeleteDialog } from "./story-delete-dialog";
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
  const [deleting, setDeleting] = useState<StoryItem | null>(null);

  // URL-driven filter from the breadcrumb's own filter bar (see
  // navegation_params.ts's `storytelling` entry), same pattern as fleet-management.
  const nameFilter = (searchParams.get("name") ?? "").trim().toLowerCase();

  const visible = useMemo(() => {
    return stories.filter((story) =>
      nameFilter ? story.title.toLowerCase().includes(nameFilter) : true
    );
  }, [stories, nameFilter]);

  const hasActiveFilters = nameFilter !== "";

  function handleDeleteConfirm() {
    if (!deleting) return;
    removeStory(deleting.id);
    setStories((prev) => prev.filter((s) => s.id !== deleting.id));
    toast.success(tr("toast.deleted", dict, { name: deleting.title }));
    setDeleting(null);
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
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("description", dict)}
          </p>
        </div>

        <StoryGrid
          stories={visible}
          lang={lang}
          dict={dict}
          emptyMessage={
            hasActiveFilters ? tr("filters.noMatches", dict) : tr("list.empty", dict)
          }
          onShare={setSharing}
          onDelete={setDeleting}
        />
      </div>

      <StoryShareModal
        story={sharing}
        lang={lang}
        onClose={() => setSharing(null)}
        dict={dict}
      />

      <StoryDeleteDialog
        story={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteConfirm}
        dict={dict}
      />
    </div>
  );
}

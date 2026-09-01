"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HiArrowDownTray,
  HiArrowLeft,
  HiChevronDown,
  HiChevronUp,
  HiMagnifyingGlass,
  HiShare,
  HiSparkles,
  HiTrash,
  HiXMark,
} from "react-icons/hi2";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { getStory, removeStory } from "../storytelling-store";
import { StoryDeleteDialog } from "./story-delete-dialog";
import {
  HTML_DOWNLOAD_FILENAME,
  HTML_PREVIEW_URL,
  HtmlPreviewer,
  MARKDOWN_DOWNLOAD_FILENAME,
  MARKDOWN_PREVIEW_URL,
  MarkdownPreviewer,
  PDF_DOWNLOAD_FILENAME,
  PDF_PREVIEW_URL,
  PdfPreviewer,
  PptPreviewer,
  type SearchableHandle,
} from "./previewers";

const SEARCHABLE_TYPES = new Set(["html", "markdown", "ppt"]);

const base_path = process.env.NEXT_PUBLIC_BASE_PATH;
const GENERATE_PPTX_URL = `${base_path ?? ""}/api/storytelling/generate-pptx`;

interface StoryDetailPageProps {
  readonly dict: I18nRecord;
  readonly id: string;
  /** Full root dictionary — only needed to satisfy SectionHeader's filter-bar
   * slot, which self-suppresses on this route (no nav params registered for
   * a dynamic /storytelling/[id] segment), same as the list page passes it. */
  readonly rootDict: I18nRecord;
}

/** html/markdown/pdf are static test files — a plain GET link. ppt has no
 * file at all: it's generated on demand from the story's deck content, so
 * downloading it means POSTing that content and streaming back a blob. */
function staticDownloadTargetFor(artifactType: string): { url: string; filename: string } | null {
  switch (artifactType) {
    case "html":
      return { url: HTML_PREVIEW_URL, filename: HTML_DOWNLOAD_FILENAME };
    case "markdown":
      return { url: MARKDOWN_PREVIEW_URL, filename: MARKDOWN_DOWNLOAD_FILENAME };
    case "pdf":
      return { url: PDF_PREVIEW_URL, filename: PDF_DOWNLOAD_FILENAME };
    default:
      return null;
  }
}

export default function StoryDetailPage({ dict, id, rootDict }: StoryDetailPageProps) {
  const { lang } = useParams<{ lang: string }>();
  const router = useRouter();
  // Looked up once on mount: the store is localStorage-backed, so a fresh
  // page load is the only time it can have changed since this route rendered.
  const [story] = useState(() => getStory(id));
  const [deleting, setDeleting] = useState(false);

  // Same behavior the HTML previewer's injected per-card toolbar's Share
  // button uses — native share sheet if available, else copy the link.
  // Story-level (shares the page URL), so it's the same for every artifact
  // type, not just HTML.
  const handleShare = useCallback(async () => {
    const shareData = { title: story?.title, url: window.location.href };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareData.url);
    }
  }, [story?.title]);

  const handleDeleteConfirm = useCallback(() => {
    if (!story) return;
    removeStory(story.id);
    toast.success(tr("toast.deleted", dict, { name: story.title }));
    router.push(`/${lang}/storytelling`);
  }, [story, dict, lang, router]);

  // Find-in-page, delegated to whichever previewer is mounted — Html,
  // Markdown, and Ppt all implement SearchableHandle (see previewers/
  // searchable.ts); only one previewer ever renders at a time (switched on
  // artifactType below), so one ref covers all three. Pdf doesn't: it's a
  // native browser <iframe src="file.pdf">, and there's no way to script a
  // browser's built-in PDF viewer's search from outside.
  const previewerRef = useRef<SearchableHandle>(null);
  const [previewerReady, setPreviewerReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);

  const runSearch = useCallback((query: string) => {
    setSearchQuery(query);
    const count = previewerRef.current?.search(query) ?? 0;
    setMatchCount(count);
    setCurrentMatch(count > 0 ? 0 : -1);
  }, []);

  const stepMatch = useCallback((delta: number) => {
    const next = previewerRef.current?.stepMatch(delta);
    if (next !== undefined) setCurrentMatch(next);
  }, []);

  if (!story) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr("detail.notFound.title", dict)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("detail.notFound.description", dict)}
        </p>
        <Link
          href={`/${lang}/storytelling`}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <HiArrowLeft className="h-4 w-4" />
          {tr("detail.notFound.backButton", dict)}
        </Link>
      </div>
    );
  }

  // Falls back to "html" (the only type that ever existed before
  // artifactType was added) for any story missing the field — localStorage
  // persists across code changes, so stories saved before this feature
  // shipped won't have it until they're re-saved.
  const artifactType = story.artifactType ?? "html";
  const searchable = SEARCHABLE_TYPES.has(artifactType);
  const staticDownloadTarget = staticDownloadTargetFor(artifactType);
  const canDownload = staticDownloadTarget !== null || (artifactType === "ppt" && !!story.deck);

  async function handleDownload() {
    // Narrowing from the early `if (!story) return` above doesn't carry
    // into this nested async function — TS treats it as possibly running
    // after `story` changed, even though it's a const from useState.
    if (!story) return;
    if (staticDownloadTarget) {
      const link = document.createElement("a");
      link.href = staticDownloadTarget.url;
      link.download = staticDownloadTarget.filename;
      link.click();
      return;
    }
    if (artifactType === "ppt" && story.deck) {
      const res = await fetch(GENERATE_PPTX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(story.deck),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${story.id}.pptx`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <div className="animate-story-enter flex h-full w-full flex-col">
      {/* Same shared header the storytelling list page uses (SectionHeader),
          so the two views look identical — only the breadcrumb content
          differs (a dynamic story title vs. the static list crumb), passed
          via leftContent since Breadcrumb (SectionHeader's default) only
          supports static translation-key paths, not a per-item dynamic
          label like ClientBreadcrumb does. */}
      <SectionHeader
        filterDict={rootDict}
        leftContent={
          <ClientBreadcrumb
            dict={(dict?.breadcrumb as I18nRecord) ?? {}}
            rootIcon={<HiSparkles className="mr-2 h-4 w-4" />}
            path={[
              { label: "storytelling", href: "/storytelling" },
              { label: story.title },
            ]}
          />
        }
        rightContent={
          <>
          {searchable && (
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800">
            <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => runSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                stepMatch(e.shiftKey ? -1 : 1);
              }}
              disabled={!previewerReady}
              placeholder={tr("detail.search.placeholder", dict)}
              className="w-40 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none disabled:cursor-not-allowed dark:text-white dark:placeholder-gray-500"
            />
            {searchQuery && (
              <>
                <span className="shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">
                  {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : "0/0"}
                </span>
                <button
                  type="button"
                  onClick={() => stepMatch(-1)}
                  disabled={matchCount === 0}
                  aria-label={tr("detail.search.previous", dict)}
                  className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  <HiChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => stepMatch(1)}
                  disabled={matchCount === 0}
                  aria-label={tr("detail.search.next", dict)}
                  className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  <HiChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => runSearch("")}
                  aria-label={tr("detail.search.clear", dict)}
                  className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          )}
          <div className="flex items-center gap-1">
            {canDownload && (
              <button
                type="button"
                onClick={handleDownload}
                title={tr("menu.download", dict)}
                aria-label={tr("menu.download", dict)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <HiArrowDownTray className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleShare}
              title={tr("menu.share", dict)}
              aria-label={tr("menu.share", dict)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <HiShare className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              title={tr("menu.delete", dict)}
              aria-label={tr("menu.delete", dict)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <HiTrash className="h-4 w-4" />
            </button>
          </div>
          </>
        }
      />
      {artifactType === "html" && (
        <HtmlPreviewer
          ref={previewerRef}
          title={story.title}
          dict={dict}
          onReadyChange={setPreviewerReady}
        />
      )}
      {artifactType === "markdown" && (
        <MarkdownPreviewer ref={previewerRef} dict={dict} onReadyChange={setPreviewerReady} />
      )}
      {artifactType === "ppt" && story.deck && (
        <PptPreviewer ref={previewerRef} deck={story.deck} onReadyChange={setPreviewerReady} />
      )}
      {artifactType === "pdf" && <PdfPreviewer title={story.title} />}
      <StoryDeleteDialog
        stories={deleting ? [story] : []}
        onClose={() => setDeleting(false)}
        onConfirm={handleDeleteConfirm}
        dict={dict}
      />
    </div>
  );
}

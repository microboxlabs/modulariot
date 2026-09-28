"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HiArrowDownTray,
  HiArrowLeft,
  HiChatBubbleLeftRight,
  HiChevronDown,
  HiChevronUp,
  HiMagnifyingGlass,
  HiOutlinePencilSquare,
  HiSparkles,
  HiTrash,
  HiXMark,
} from "react-icons/hi2";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import { CopyLinkButton } from "@/features/share-links/components/copy-link-button";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  StoriesApiError,
  deleteStory,
  getStory,
  updateStory,
} from "../stories-api";
import { downloadFor, renderForVersion } from "../story-content";
import type { Story } from "../storytelling.types";
import { useStoryChat } from "../use-story-chat";
import type { SearchableHandle } from "./previewers/searchable";
import { StoryContentView } from "./story-content-view";
import { StoryDeleteDialog } from "./story-delete-dialog";
import { StoryRenameDialog } from "./story-rename-dialog";
import StorySharePanel from "./story-share-panel";
import StoryVersionBadge from "./story-version-badge";

const base_path = process.env.NEXT_PUBLIC_BASE_PATH;
const GENERATE_PPTX_URL = `${base_path ?? ""}/api/storytelling/generate-pptx`;

const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200";

interface StoryDetailPageProps {
  readonly dict: I18nRecord;
  readonly id: string;
  /** Full root dictionary — only to satisfy SectionHeader's filter-bar slot. */
  readonly rootDict: I18nRecord;
}

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "missing" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly story: Story };

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function StoryMessage({
  title,
  description,
  lang,
  dict,
}: {
  readonly title: string;
  readonly description?: string;
  readonly lang: string;
  readonly dict: I18nRecord;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </p>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
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

export default function StoryDetailPage({
  dict,
  id,
  rootDict,
}: StoryDetailPageProps) {
  const { lang } = useParams<{ lang: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStory(id)
      .then((story) => {
        if (!cancelled) setState({ status: "ready", story });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const missing =
          error instanceof StoriesApiError &&
          (error.status === 404 || error.status === 403);
        setState({ status: missing ? "missing" : "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const story = state.status === "ready" ? state.story : null;
  const chat = useStoryChat(story, dict);
  const render = useMemo(
    () => (story ? renderForVersion(story.kind, story.currentVersion) : null),
    [story]
  );

  const previewerRef = useRef<SearchableHandle>(null);
  const [previewerReady, setPreviewerReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);

  const runSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // The HTML previewer answers over postMessage; the others synchronously.
    void Promise.resolve(previewerRef.current?.search(query) ?? 0).then(
      (count) => {
        setMatchCount(count);
        setCurrentMatch(count > 0 ? 0 : -1);
      }
    );
  }, []);

  const stepMatch = useCallback((delta: number) => {
    void Promise.resolve(previewerRef.current?.stepMatch(delta)).then(
      (next) => {
        if (next !== undefined && next !== null) setCurrentMatch(next);
      }
    );
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!story) return;
    try {
      await deleteStory(story.id);
      toast.success(tr("toast.deleted", dict, { name: story.title }));
      router.push(`/${lang}/storytelling`);
    } catch {
      toast.error(tr("toast.failed", dict));
      setDeleting(false);
    }
  }, [story, dict, lang, router]);

  const handleRename = useCallback(
    async (title: string) => {
      if (!story) return;
      setRenaming(false);
      try {
        const saved = await updateStory(story.id, { title });
        setState({ status: "ready", story: { ...story, title: saved.title } });
      } catch {
        toast.error(tr("toast.failed", dict));
      }
    },
    [story, dict]
  );

  if (state.status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400" />
      </div>
    );
  }
  if (state.status === "missing") {
    return (
      <StoryMessage
        title={tr("detail.notFound.title", dict)}
        description={tr("detail.notFound.description", dict)}
        lang={lang}
        dict={dict}
      />
    );
  }
  if (state.status === "failed" || !story || !render) {
    return (
      <StoryMessage
        title={tr("detail.loadFailed", dict)}
        lang={lang}
        dict={dict}
      />
    );
  }

  const searchable = render.type !== "svg" && render.type !== "empty";
  const download = downloadFor(render, story.title);
  const canDownload = download !== null || render.type === "deck";
  const canEdit = story.permission !== "read";

  async function handleDownload() {
    if (!story || !render) return;
    if (download) {
      saveBlob(download.blob, download.filename);
      return;
    }
    if (render.type === "deck") {
      const res = await fetch(GENERATE_PPTX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(render.deck),
      });
      if (!res.ok) {
        toast.error(tr("toast.failed", dict));
        return;
      }
      saveBlob(await res.blob(), `${story.title || "story"}.pptx`);
    }
  }

  return (
    <div className="animate-story-enter flex h-full w-full flex-col">
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
            rightContent={
              story.currentVersion
                ? [
                    {
                      key: "version",
                      content: (
                        <StoryVersionBadge
                          label={story.currentVersion.label}
                          href={`/${lang}/storytelling/${encodeURIComponent(story.id)}/versions`}
                          dict={dict}
                        />
                      ),
                    },
                  ]
                : []
            }
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
                      {matchCount > 0
                        ? `${currentMatch + 1}/${matchCount}`
                        : "0/0"}
                    </span>
                    <button
                      type="button"
                      onClick={() => stepMatch(-1)}
                      disabled={matchCount === 0}
                      aria-label={tr("detail.search.previous", dict)}
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                      <HiChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => stepMatch(1)}
                      disabled={matchCount === 0}
                      aria-label={tr("detail.search.next", dict)}
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                      <HiChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => runSearch("")}
                      aria-label={tr("detail.search.clear", dict)}
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                      <HiXMark className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-1">
              {chat?.openConversation && (
                <button
                  type="button"
                  onClick={chat.openConversation}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <HiChatBubbleLeftRight className="h-4 w-4" />
                  {tr("detail.openConversation", dict)}
                </button>
              )}
              <button
                type="button"
                onClick={chat?.continueInChat}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <HiSparkles className="h-4 w-4" />
                {tr("detail.continueInChat", dict)}
              </button>
              {canDownload && (
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  title={tr("menu.download", dict)}
                  aria-label={tr("menu.download", dict)}
                  className={ICON_BUTTON}
                >
                  <HiArrowDownTray className="h-4 w-4" />
                </button>
              )}
              {story.owned && (
                <StorySharePanel
                  story={story}
                  dict={dict}
                  onSharesChange={(sharedWith) =>
                    setState({
                      status: "ready",
                      story: { ...story, sharedWith },
                    })
                  }
                >
                  <div className="mb-4 border-b border-gray-100 pb-4 dark:border-gray-800">
                    <CopyLinkButton
                      targetType="story"
                      targetId={story.id}
                      lang={lang}
                      label={tr("share.copyLink", dict)}
                      copiedMessage={tr("share.copied", dict)}
                      failedMessage={tr("share.copyFailed", dict)}
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {tr("share.linkHint", dict)}
                    </p>
                  </div>
                </StorySharePanel>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  title={tr("menu.rename", dict)}
                  aria-label={tr("menu.rename", dict)}
                  className={ICON_BUTTON}
                >
                  <HiOutlinePencilSquare className="h-4 w-4" />
                </button>
              )}
              {story.owned && (
                <button
                  type="button"
                  onClick={() => setDeleting(true)}
                  title={tr("menu.delete", dict)}
                  aria-label={tr("menu.delete", dict)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                >
                  <HiTrash className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        }
      />
      <StoryContentView
        key={story.currentVersion?.id ?? "none"}
        render={render}
        title={story.title}
        dict={dict}
        previewerRef={previewerRef}
        onReadyChange={setPreviewerReady}
        onAskHarness={chat?.askAbout}
      />
      <StoryDeleteDialog
        stories={deleting ? [story] : []}
        onClose={() => setDeleting(false)}
        onConfirm={() => void handleDeleteConfirm()}
        dict={dict}
      />
      <StoryRenameDialog
        story={renaming ? story : null}
        onClose={() => setRenaming(false)}
        onConfirm={(title) => void handleRename(title)}
        dict={dict}
      />
    </div>
  );
}

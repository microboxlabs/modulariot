"use client";

import { useEffect, useMemo, useState } from "react";
import { HiLink } from "react-icons/hi2";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { StoryContentView } from "@/features/storytelling/components/story-content-view";
import { renderForVersion } from "@/features/storytelling/story-content";
import { getStoryKindMeta } from "@/features/storytelling/story-kind-meta";
import {
  LinkApiError,
  resolveLink,
  type LinkSnapshot,
  type SharedMessage,
} from "../share-links-api";
import { toTranscript, type TranscriptEntry } from "../transcript";

/** Messages read per page of a shared thread. */
export const MESSAGE_PAGE = 200;

interface ShareSnapshotPageProps {
  readonly token: string;
  readonly lang: string;
  /** `shareLink` dict namespace. */
  readonly dict: I18nRecord;
  /** `storytelling` dict namespace, for the story previewers. */
  readonly storyDict: I18nRecord;
}

type State =
  | { readonly status: "loading" }
  | { readonly status: "missing" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly snapshot: LinkSnapshot };

function Header({
  title,
  subtitle,
  dict,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly dict: I18nRecord;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
      <HiLink className="h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      </div>
      <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        {tr("readOnly", dict)}
      </span>
    </div>
  );
}

/** A turn's parts never reorder, so their position is a stable key. */
function partsWithKeys(entry: TranscriptEntry) {
  return entry.parts.map((part, position) => ({
    key: `${entry.id}-${position}`,
    part,
  }));
}

function Transcript({
  entries,
  dict,
}: {
  readonly entries: readonly TranscriptEntry[];
  readonly dict: I18nRecord;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        {tr("thread.empty", dict)}
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={
            entry.role === "user"
              ? "flex flex-col items-end"
              : "flex flex-col items-start"
          }
        >
          <span className="mb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
            {entry.role === "user"
              ? tr("thread.user", dict)
              : tr("thread.assistant", dict)}
          </span>
          <div
            className={
              entry.role === "user"
                ? "max-w-[85%] rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                : "w-full text-sm text-gray-800 dark:text-gray-200"
            }
          >
            {partsWithKeys(entry).map(({ key, part }) => {
              if (part.kind === "text") {
                return <MarkdownContent key={key}>{part.text}</MarkdownContent>;
              }
              const label =
                part.kind === "attachment"
                  ? part.name
                  : [part.name, part.title].filter(Boolean).join(" · ");
              return (
                <span
                  key={key}
                  className="my-1 mr-1 inline-flex items-center rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A read-only view of what a share link points at: a story's current
 * version, or a chat thread's transcript. */
export default function ShareSnapshotPage({
  token,
  lang,
  dict,
  storyDict,
}: ShareSnapshotPageProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [messages, setMessages] = useState<readonly SharedMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const locale = lang === "en" ? "en-US" : "es-CL";

  useEffect(() => {
    let cancelled = false;
    resolveLink(token, { limit: MESSAGE_PAGE })
      .then((snapshot) => {
        if (cancelled) return;
        const page = snapshot.messages ?? [];
        setMessages(page);
        setHasMore(page.length >= MESSAGE_PAGE);
        setState({ status: "ready", snapshot });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const missing =
          error instanceof LinkApiError && [403, 404].includes(error.status);
        setState({ status: missing ? "missing" : "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const entries = useMemo(() => toTranscript(messages), [messages]);
  const snapshot = state.status === "ready" ? state.snapshot : null;
  const render = useMemo(
    () =>
      snapshot?.story
        ? renderForVersion(snapshot.story.kind, snapshot.version)
        : null,
    [snapshot]
  );

  async function loadMore() {
    const last = messages.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      const next = await resolveLink(token, {
        after: last.seq,
        limit: MESSAGE_PAGE,
      });
      const page = next.messages ?? [];
      setMessages((prev) => [...prev, ...page]);
      setHasMore(page.length >= MESSAGE_PAGE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400" />
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {state.status === "missing"
            ? tr("notFound.title", dict)
            : tr("loadFailed", dict)}
        </p>
        {state.status === "missing" && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("notFound.description", dict)}
          </p>
        )}
      </div>
    );
  }

  if (snapshot.story && render) {
    const story = snapshot.story;
    return (
      <div className="flex h-full w-full flex-col">
        <Header
          title={story.title}
          subtitle={[
            trDynamic(getStoryKindMeta(story.kind).labelKey, storyDict),
            snapshot.version?.label,
            formatDateString(story.updatedAt, "date", locale),
          ]
            .filter(Boolean)
            .join(" · ")}
          dict={dict}
        />
        <StoryContentView
          render={render}
          title={story.title}
          dict={storyDict}
        />
      </div>
    );
  }

  const thread = snapshot.thread;
  return (
    <div className="flex h-full w-full flex-col">
      <Header
        title={thread?.title || tr("thread.untitled", dict)}
        subtitle={
          thread
            ? formatDateString(
                thread.lastMessageAt ?? thread.createdAt,
                "datetime",
                locale
              )
            : ""
        }
        dict={dict}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-6">
          <Transcript entries={entries} dict={dict} />
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {tr("thread.loadMore", dict)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

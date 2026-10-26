"use client";

import { createContext, useContext, useMemo } from "react";
import { useSWRConfig } from "swr";
import {
  deleteBentoMultimedia,
  deleteContentForumPost,
  deleteContentForumTopic,
  putBentoMultimedia,
  recordReviewRound,
  renameBentoFile,
  replyContentForumPost,
  updateBentoCategory,
  useGetNodeContents,
  useGetNodeThumbnail,
  useObservationTypes,
  useOptimisticFileUpload,
} from "@/features/common/providers/client-api.provider";
import type {
  ForumDiscussionResponse,
  ReviewRoundResponse,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";
import type { ObservationTypeItem } from "@/features/common/providers/alfresco-api/observation-types.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { getCategories } from "./clasification-form";
import type { AlfrescoFileEntry } from "./image.types";

export type MediaCategory = { value: string; label: string };
export type Verdict = "APPROVED" | "REJECTED" | "PENDING";

/** A file's review history: its rounds, else (Alfresco only) the forum discussion that predates them. */
export type MediaHistory = {
  rounds: ReviewRoundResponse[] | null;
  forum: ForumDiscussionResponse | null;
};

/**
 * Where the multimedia component reads and writes its files. Files come in the shape of an Alfresco node
 * (`AlfrescoFileEntry`), with the type in `mintral:contentType`, the review state in `mintral:reviewStatus`,
 * `mintral:reviewedAt` and `mintral:reviewedBy`, the version in `cm:versionLabel`, and
 * `mintral:reviewableAspect` among `aspectNames` when the type needs review.
 */
export interface MediaSource {
  /** False while the source has nowhere to read from (a task without a package). */
  ready: boolean;
  /** Whether a deleted file can be recovered (Alfresco's trash). */
  recoverableDelete: boolean;
  /** The API resets this status when content or its classification changes. */
  reviewStatusIsCurrent?: boolean;
  /** The files, or null until they load. */
  useFiles(): {
    files: AlfrescoFileEntry[] | null;
    isLoading: boolean;
    refresh: () => Promise<unknown>;
  };
  /** Adds a file with its category; `skipRevalidation` for all but the last file of a batch. */
  useUpload(): (
    file: File,
    category: string,
    name: string,
    skipRevalidation: boolean
  ) => Promise<unknown>;
  useThumbnail(id: string): { data: Blob | null | undefined; error: unknown };
  useCategories(dictionary: I18nRecord): Record<string, MediaCategory>;
  useObservationTypes(category?: string | null): {
    observationTypes: ObservationTypeItem[];
  };
  /** Clears the cached thumbnail after a replace. */
  useInvalidateThumbnail(): (id: string) => Promise<unknown>;
  replace(id: string, file: File): Promise<unknown>;
  remove(id: string): Promise<unknown>;
  setCategory(id: string, category: string): Promise<unknown>;
  rename(id: string, name: string): Promise<unknown>;
  contentUrl(id: string): string;
  downloadUrl(id: string): string;
  history(id: string): Promise<MediaHistory>;
  recordRound(
    id: string,
    verdict: Verdict,
    reasons: string[],
    comment?: string,
    expectedModifiedAt?: string
  ): Promise<unknown>;
  /** Alfresco's per-file forum, for content decided before review rounds existed. */
  forum?: {
    reply(
      topic: string,
      post: string,
      content: string,
      author?: string
    ): Promise<unknown>;
    deletePost(topic: string, post: string): Promise<unknown>;
    deleteTopic(topic: string): Promise<unknown>;
  };
  /** Moving a file to another task; absent where there are no tasks. */
  move?: { serviceCode?: string };
}

function toNodeRef(id: string): string {
  if (id.startsWith("workspace://")) return id;
  return `workspace://SpacesStore/${id}`;
}

/** A task package in Alfresco, through the `/app/api/bento/*`, review and forum routes. */
export function createAlfrescoSource(
  packageId: string | undefined,
  serviceCode?: string
): MediaSource {
  return {
    ready: Boolean(packageId),
    recoverableDelete: true,
    useFiles() {
      const { data, isLoading, mutate } = useOptimisticFileUpload(packageId);
      const entries: AlfrescoFileEntry[] = useMemo(
        () => data?.data?.list?.entries || [],
        [data]
      );
      const contents = useGetNodeContents(entries.map((f) => f.entry.id));
      // A node whose document read failed is left out, as the gallery always did.
      const files = useMemo(() => {
        if (!contents.data) return null;
        return entries.filter(
          (_, i) => contents.data.data?.[i] && !contents.data.data[i].error
        );
      }, [entries, contents.data]);
      return {
        files: entries.length === 0 && data ? [] : files,
        isLoading: isLoading || contents.isLoading,
        refresh: async () => {
          await mutate();
          await contents.mutate();
        },
      };
    },
    useUpload() {
      const { uploadFile } = useOptimisticFileUpload(packageId);
      return (file, category, name, skipRevalidation) =>
        uploadFile(
          {
            filedata: file,
            prop_mintral_contentType: category,
            prop_cm_name: name,
            prop_mimetype: file.type,
            alf_destination: `workspace://SpacesStore/${packageId}`,
          },
          skipRevalidation
        );
    },
    useThumbnail(id) {
      return useGetNodeThumbnail(id);
    },
    useCategories(dictionary) {
      return getCategories(dictionary);
    },
    useObservationTypes(category) {
      return useObservationTypes(category);
    },
    useInvalidateThumbnail() {
      const { mutate } = useSWRConfig();
      return (id) => mutate(`/app/api/bento/thumbnails?nodeId=${id}`);
    },
    replace: async (id, file) => {
      const result = await putBentoMultimedia(id, file);
      if (!result.success) throw new Error("Update failed");
      return result;
    },
    remove: (id) => deleteBentoMultimedia(id),
    setCategory: (id, category) => updateBentoCategory(id, category),
    rename: (id, name) => renameBentoFile(id, name),
    contentUrl: (id) => `/app/api/bento/content?nodeId=${id}`,
    downloadUrl: (id) => `/app/api/document/download?documentId=${id}`,
    history: async (id) => {
      const nodeRef = encodeURIComponent(toNodeRef(id));
      const roundsRes = await fetch(
        `/app/api/review/rounds?contentNodeRef=${nodeRef}`
      );
      if (roundsRes.ok) {
        const { rounds } = (await roundsRes.json()) as {
          rounds: ReviewRoundResponse[];
        };
        if (rounds?.length) return { rounds, forum: null };
      }
      const res = await fetch(
        `/app/api/forum/content?contentNodeRef=${nodeRef}`
      );
      if (!res.ok) return { rounds: null, forum: null };
      return {
        rounds: null,
        forum: (await res.json()) as ForumDiscussionResponse,
      };
    },
    recordRound: (id, verdict, reasons, comment) =>
      recordReviewRound({
        contentNodeRef: toNodeRef(id),
        verdict,
        reasons,
        comment,
      }),
    forum: {
      reply: (topic, post, content, author) =>
        replyContentForumPost(topic, post, content, author),
      deletePost: (topic, post) => deleteContentForumPost(topic, post),
      deleteTopic: (topic) => deleteContentForumTopic(toNodeRef(topic)),
    },
    move: { serviceCode },
  };
}

const MediaSourceContext = createContext<MediaSource>(
  createAlfrescoSource(undefined)
);

export const MediaSourceProvider = MediaSourceContext.Provider;

/** The source of the multimedia component around; Alfresco when none was given. */
export function useMediaSource() {
  return useContext(MediaSourceContext);
}

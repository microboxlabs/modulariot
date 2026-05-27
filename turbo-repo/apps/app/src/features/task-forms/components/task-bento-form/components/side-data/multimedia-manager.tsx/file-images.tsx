"use client";

import { Button, Checkbox, Modal, ModalHeader, ModalBody } from "flowbite-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { MdOutlineFileUpload } from "react-icons/md";
import { HiChevronDown, HiArrowDownTray } from "react-icons/hi2";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useSession } from "next-auth/react";
import {
  useGetNodeContents,
  useOptimisticFileUpload,
  putBentoMultimedia,
  deleteBentoMultimedia,
  updateBentoReviewState,
  createContentForumTopic,
  replyContentForumPost,
  deleteContentForumPost,
  deleteContentForumTopic,
} from "@/features/common/providers/client-api.provider";
import { TaskResponse, ForumDiscussionResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ClasificationForm from "./clasification-form";
import FileViewer from "./file_viewer";
import DocumentList from "./document-list";
import { AlfrescoFileEntry } from "./image.types";
import ReplaceImageModal from "@/features/geographic-view/components/image-viewer/replace-image-modal";
import MediaInlineViewer, { MediaViewerItem } from "./media-inline-viewer";
import type { ObservationEntry, ObservationType, TimelineEntry, StateChangeTimelineEntry, LooseObservationTimelineEntry } from "./media-inline-viewer";
import MediaRow, { ReviewStatus } from "./media-row";

function toNodeRef(id: string): string {
  if (id.startsWith("workspace://")) return id;
  return `workspace://SpacesStore/${id}`;
}

function statusColorCls(s: string): string {
  if (s === "approved") return "text-green-600 dark:text-green-400";
  if (s === "rejected") return "text-red-600 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

function statusDotCls(s: string): string {
  if (s === "approved") return "bg-green-500";
  if (s === "rejected") return "bg-red-500";
  return "bg-amber-500";
}

function statusLabelKey(s: string): string {
  if (s === "approved") return "bento.multimedia.status_approved";
  if (s === "rejected") return "bento.multimedia.status_rejected";
  return "bento.multimedia.status_pending";
}

function stripObservationFromEntry(entry: TimelineEntry, obsId: string): TimelineEntry {
  if (entry.kind === "state_change") {
    return { ...entry, observations: entry.observations.filter((o) => o.id !== obsId) };
  }
  return entry;
}

type Reply = { id: string; description: string; createdAt: Date; createdBy: string | undefined };

function addReplyToEntry(entry: TimelineEntry, obsId: string, reply: Reply): TimelineEntry {
  if (entry.kind === "observation" && entry.id === obsId) {
    return { ...entry, replies: [...(entry.replies ?? []), reply] };
  }
  if (entry.kind === "state_change") {
    return {
      ...entry,
      observations: entry.observations.map((obs) =>
        obs.id === obsId ? { ...obs, replies: [...(obs.replies ?? []), reply] } : obs
      ),
    };
  }
  return entry;
}

function removeReplyFromEntry(entry: TimelineEntry, obsId: string, replyId: string): TimelineEntry {
  if (entry.kind === "observation" && entry.id === obsId) {
    return { ...entry, replies: (entry.replies ?? []).filter((r) => r.id !== replyId) };
  }
  if (entry.kind === "state_change") {
    return {
      ...entry,
      observations: entry.observations.map((obs) =>
        obs.id === obsId ? { ...obs, replies: (obs.replies ?? []).filter((r) => r.id !== replyId) } : obs
      ),
    };
  }
  return entry;
}

function addReplyToObservation(o: ObservationEntry, obsId: string, reply: Reply): ObservationEntry {
  return o.id === obsId ? { ...o, replies: [...(o.replies ?? []), reply] } : o;
}

function removeReplyFromObservation(o: ObservationEntry, obsId: string, replyId: string): ObservationEntry {
  return o.id === obsId ? { ...o, replies: (o.replies ?? []).filter((r) => r.id !== replyId) } : o;
}

function buildCommittedEntry(
  existing: TimelineEntry[],
  status: string,
  id: string,
  now: Date,
  committedBy: string | undefined,
  extraObs: ObservationEntry[],
): TimelineEntry[] {
  const looseObs: ObservationEntry[] = existing
    .filter((e): e is LooseObservationTimelineEntry => e.kind === "observation")
    .map((e) => ({ id: e.id, type: e.type, description: e.description, createdAt: e.createdAt, createdBy: e.createdBy, replies: e.replies }));
  const withoutLoose = existing.filter((e) => e.kind !== "observation");
  const entry: StateChangeTimelineEntry = {
    kind: "state_change",
    id: `sc-${id}-${now.getTime()}`,
    status: status as "approved" | "rejected" | "pending",
    committedAt: now,
    committedBy,
    observations: [...looseObs, ...extraObs],
  };
  return [...withoutLoose, entry];
}

function stripHtmlEntities(html: string): string {
  return html
    .replaceAll(/<[^>]*>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .trim();
}

type FlatPost = {
  kind: "state_change" | "observation";
  topicRef: string;
  postRef: string;
  title: string;
  content: string;
  author: string;
  created: Date;
  replies: { ref: string; title?: string; content?: string; created: string; author: string }[];
};

function flattenTopicPosts(
  data: ForumDiscussionResponse,
  refMap: Map<string, { topicRef: string; postRef: string }>,
): FlatPost[] {
  const allPosts: FlatPost[] = [];
  for (const topic of data.topics ?? []) {
    const isStateChange = topic.title === "APPROVED" || topic.title === "REJECTED" || topic.title === "PENDING";
    for (const post of topic.posts ?? []) {
      allPosts.push({
        kind: isStateChange ? "state_change" : "observation",
        topicRef: topic.ref,
        postRef: post.ref,
        title: topic.title,
        content: post.content ?? "",
        author: post.author,
        created: new Date(post.created),
        replies: (post.replies ?? []).map((r) => ({ ref: r.ref, title: r.title, content: r.content, created: r.created, author: r.author })),
      });
      refMap.set(post.ref, { topicRef: topic.ref, postRef: post.ref });
    }
  }
  return allPosts;
}

function buildObservationEntry(obs: FlatPost): ObservationEntry {
  const plainDesc = stripHtmlEntities(obs.content);
  const match = /^\[([^\]]+)\]\s*(.*)$/.exec(plainDesc);
  const obsType = match ? (match[1] as ObservationType) : (obs.title as ObservationType) || "other";
  const obsDesc = match ? (match[2] ?? "") : plainDesc;
  return {
    id: obs.postRef,
    type: obsType,
    description: obsDesc,
    createdAt: obs.created,
    createdBy: obs.author,
    replies: obs.replies.map((r) => ({
      id: r.ref,
      description: stripHtmlEntities(r.content ?? r.title ?? ""),
      createdAt: new Date(r.created),
      createdBy: r.author,
    })),
  };
}

function buildNodeTimeline(data: ForumDiscussionResponse, refMap: Map<string, { topicRef: string; postRef: string }>): TimelineEntry[] {
  const allPosts = flattenTopicPosts(data, refMap);
  allPosts.sort((a, b) => a.created.getTime() - b.created.getTime());

  const stateChangePosts = allPosts.filter((p) => p.kind === "state_change");
  const observationPosts = allPosts.filter((p) => p.kind === "observation");

  const stateChangeEntries: StateChangeTimelineEntry[] = stateChangePosts.map((p) => ({
    kind: "state_change" as const,
    id: p.postRef,
    status: p.title.toLowerCase() as "approved" | "rejected" | "pending",
    committedAt: p.created,
    committedBy: p.author,
    observations: [],
  }));

  const entries: TimelineEntry[] = [];
  for (const obs of observationPosts) {
    const obsEntry = buildObservationEntry(obs);
    const owning = stateChangeEntries.find((sc) => sc.committedAt.getTime() >= obs.created.getTime());
    if (owning) {
      owning.observations.push(obsEntry);
    } else {
      entries.push({ kind: "observation", ...obsEntry });
    }
  }
  entries.push(...stateChangeEntries);
  return entries;
}

export const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

function filterValidFiles(files: File[], dictionary: I18nRecord): File[] | null {
  const validFiles = files.filter((file) => ALLOWED_FILE_TYPES.has(file.type));
  if (validFiles.length !== files.length) {
    alert(tr("bento.multimedia.only_jpg_jpeg_png_pdf_allowed", dictionary));
    return null;
  }
  return validFiles;
}

export function extractImageUrlFromDrop(dataTransfer: DataTransfer): string | null {
  const uriList = dataTransfer.getData("text/uri-list");
  if (uriList) {
    const urls = uriList.split("\n").filter((url) => url.trim() && !url.startsWith("#"));
    if (urls.length > 0) return urls[0];
  }
  const plainText = dataTransfer.getData("text/plain");
  if (plainText && (plainText.startsWith("http://") || plainText.startsWith("https://"))) {
    return plainText;
  }
  const html = dataTransfer.getData("text/html");
  if (html) {
    const srcMatch = /src=["']([^"']+)["']/.exec(html);
    if (srcMatch?.[1]) return srcMatch[1];
  }
  return null;
}

export function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const FETCH_TIMEOUT_MS = 10000;

export async function fetchImageAsFile(imageUrl: string): Promise<File | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    if (!ALLOWED_FILE_TYPES.has(blob.type)) return null;
    const urlPath = new URL(imageUrl).pathname;
    const urlFilename = urlPath.split("/").pop() || "";
    const extension = blob.type.split("/")[1] || "jpg";
    const filename = urlFilename.includes(".") ? urlFilename : `downloaded-image-${Date.now()}.${extension}`;
    return new File([blob], filename, { type: blob.type });
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

function MediaSection({
  label,
  filteredCount,
  isExpanded,
  onToggleExpanded,
  checkboxTitle,
  allItemIds,
  selectedIds,
  setSelectedIds,
  emptyText,
  children,
}: Readonly<{
  label: string;
  filteredCount: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  checkboxTitle: string;
  allItemIds: string[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  emptyText: string;
  children: React.ReactNode;
}>) {
  const allChecked = allItemIds.length > 0 && allItemIds.every((id) => selectedIds.has(id));
  const someChecked = allItemIds.some((id) => selectedIds.has(id)) && !allChecked;

  return (
    <div className={`flex flex-col ${isExpanded ? "border-b border-gray-200 dark:border-gray-600" : ""}`}>
      <div className="flex items-center sticky top-0 z-10 bg-gray-50/60 dark:bg-gray-800/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex items-center gap-2 flex-1 px-2 py-2 text-left group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors min-w-0 border-b border-b border-gray-200 dark:border-gray-600"
        >
          <div className="flex items-center gap-2 flex-1 text-left group transition-colors min-w-0">
            <HiChevronDown
              className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200 shrink-0 ${
                isExpanded ? "" : "-rotate-90"
              }`}
            />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 uppercase tracking-wider transition-colors">
              {label}
            </span>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              ({filteredCount})
            </span>
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              title={checkboxTitle}
              checked={allChecked}
              ref={(el) => {
                if (el) el.indeterminate = someChecked;
              }}
              onChange={(e) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) { allItemIds.forEach((id) => next.add(id)); }
                  else { allItemIds.forEach((id) => next.delete(id)); }
                  return next;
                });
                if (!isExpanded) onToggleExpanded();
              }}
            />
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-2 py-2 pr-2">
          {filteredCount > 0 ? children : (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-2">{emptyText}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function FileImages({
  task,
  dictionary,
  isExpanded = false,
  onRequestExpand,
  onRequestCollapse,
}: Readonly<{
  task: TaskResponse | null;
  dictionary: I18nRecord;
  isExpanded?: boolean;
  onRequestExpand?: () => void;
  onRequestCollapse?: () => void;
}>) {
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFetchingFromUrl, setIsFetchingFromUrl] = useState(false);
  const [isClasificationFormOpen, setIsClasificationFormOpen] = useState(false);
  const [isDocumentListOpen, setIsDocumentListOpen] = useState(false);
  const [uploadableFiles, setUploadableFiles] = useState<any[]>([]);
  const [editImageIndex, setEditImageIndex] = useState<number | null>(null);

  const [images, setImages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);

  const [isImagesExpanded, setIsImagesExpanded] = useState(true);
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<"approved" | "review">("approved");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const allIds = useMemo(
    () => [
      ...images.map((img) => img.file.entry.id),
      ...documents.map((doc: { file: AlfrescoFileEntry }) => doc.file.entry.id),
    ],
    [images, documents]
  );
  const allSelected = allIds.length > 0 && selectedIds.size === allIds.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < allIds.length;

  const [reviewStatuses, setReviewStatuses] = useState<Map<string, ReviewStatus>>(new Map());
  const [reviewStatusTimestamps, setReviewStatusTimestamps] = useState<Map<string, Date>>(new Map());
  const [reviewStatusUsers, setReviewStatusUsers] = useState<Map<string, string>>(new Map());
  const [draftDecisions, setDraftDecisions] = useState<Map<string, ReviewStatus>>(new Map());
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [draftObservations, setDraftObservations] = useState<Map<string, ObservationEntry[]>>(new Map());
  const [committedTimeline, setCommittedTimeline] = useState<Map<string, TimelineEntry[]>>(new Map());

  // Maps observation/reply IDs to their forum nodeRefs for backend operations
  const [forumRefMap, setForumRefMap] = useState<Map<string, { topicRef: string; postRef: string }>>(new Map());

  const reviewSummary = useMemo(() => {
    const approved = allIds.filter((id) => reviewStatuses.get(id) === "approved").length;
    const rejected = allIds.filter((id) => reviewStatuses.get(id) === "rejected").length;
    const pending  = allIds.filter((id) => (reviewStatuses.get(id) ?? "pending") === "pending").length;
    return { approved, rejected, pending };
  }, [allIds, reviewStatuses]);

  const draftChangeSummary = useMemo(() => {
    let toApproved = 0;
    let toRejected = 0;
    let toPending = 0;
    draftDecisions.forEach((status) => {
      if (status === "approved") toApproved++;
      else if (status === "rejected") toRejected++;
      else toPending++;
    });
    return { toApproved, toRejected, toPending, total: draftDecisions.size };
  }, [draftDecisions]);

  const filteredImages = useMemo(
    () =>
      images
        .map((img, idx) => ({ img, idx }))
        .filter(({ img }) => {
          const s = reviewStatuses.get(img.file.entry.id) ?? "pending";
          return viewMode === "approved" ? s === "approved" : s !== "approved";
        }),
    [images, viewMode, reviewStatuses]
  );

  const filteredDocuments = useMemo(
    () =>
      documents
        .map((doc: { file: AlfrescoFileEntry }, idx: number) => ({ doc, idx }))
        .filter(({ doc }) => {
          const s = reviewStatuses.get(doc.file.entry.id) ?? "pending";
          return viewMode === "approved" ? s === "approved" : s !== "approved";
        }),
    [documents, viewMode, reviewStatuses]
  );


  // Inline viewer state
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Sync: if viewer is not open but container is still expanded, collapse it
  useEffect(() => {
    if (isExpanded && viewerIndex === null) {
      onRequestCollapse?.();
    }
  }, [isExpanded, viewerIndex, onRequestCollapse]);

  const { data: session } = useSession();
  const currentUserName = session?.user?.name ?? session?.user?.email ?? undefined;


  const handleStatusChange = useCallback((id: string, status: ReviewStatus) => {
    setDraftDecisions((prev) => {
      const committed = reviewStatuses.get(id) ?? "pending";
      const next = new Map(prev);
      if (status === committed) {
        next.delete(id);
      } else {
        next.set(id, status);
      }
      return next;
    });
  }, [reviewStatuses]);

  const handleAddObservation = useCallback((fileId: string, type: ObservationType, description: string) => {
    const entry: ObservationEntry = { id: `obs-${fileId}-${Date.now()}`, type, description, createdAt: new Date(), createdBy: currentUserName };
    // Always add to committedTimeline immediately (visible right away)
    setCommittedTimeline((prev) => {
      const next = new Map(prev);
      next.set(fileId, [...(prev.get(fileId) ?? []), { kind: "observation" as const, ...entry }]);
      return next;
    });
    // Always persist immediately
    createContentForumTopic(toNodeRef(fileId), type, `[${type}] ${description}`).catch(() => {});
  }, [currentUserName]);

  const handleRemoveDraftObservation = useCallback((fileId: string, obsId: string) => {
    // Remove from committedTimeline (observations are always added there now)
    setCommittedTimeline((prev) => {
      const next = new Map(prev);
      next.set(fileId, (prev.get(fileId) ?? []).filter((e) => e.id !== obsId));
      return next;
    });
    // If the obsId is a backend ref (not a local temp id), delete the post
    if (!obsId.startsWith("obs-")) {
      const refs = forumRefMap.get(obsId);
      if (refs) {
        deleteContentForumPost(refs.topicRef, refs.postRef).catch(() => {});
      } else {
        deleteContentForumTopic(toNodeRef(obsId)).catch(() => {});
      }
    }
  }, [forumRefMap]);

  const handleRemoveCommittedObservation = useCallback((fileId: string, obsId: string) => {
    setCommittedTimeline((prev) => {
      const next = new Map(prev);
      const entries = (prev.get(fileId) ?? [])
        .filter((e) => e.id !== obsId)
        .map((e) => stripObservationFromEntry(e, obsId));
      next.set(fileId, entries);
      return next;
    });
    if (!obsId.startsWith("obs-")) {
      const refs = forumRefMap.get(obsId);
      if (refs) {
        deleteContentForumPost(refs.topicRef, refs.postRef).catch(() => {});
      } else {
        deleteContentForumTopic(toNodeRef(obsId)).catch(() => {});
      }
    }
  }, [forumRefMap]);

  const handleAddReply = useCallback((fileId: string, obsId: string, description: string) => {
    const reply = { id: `reply-${obsId}-${Date.now()}`, description, createdAt: new Date(), createdBy: currentUserName };
    setCommittedTimeline((prev) => {
      const next = new Map(prev);
      next.set(fileId, (prev.get(fileId) ?? []).map((entry) => addReplyToEntry(entry, obsId, reply)));
      return next;
    });
    setDraftObservations((prev) => {
      const obs = (prev.get(fileId) ?? []).find((o) => o.id === obsId);
      if (!obs) return prev;
      const next = new Map(prev);
      next.set(fileId, (prev.get(fileId) ?? []).map((o) => addReplyToObservation(o, obsId, reply)));
      return next;
    });
    // Persist reply to per-node forum
    const refs = forumRefMap.get(obsId);
    if (refs) {
      replyContentForumPost(refs.topicRef, refs.postRef, description, currentUserName).catch(() => {});
    }
  }, [currentUserName, forumRefMap]);

  const handleRemoveReply = useCallback((fileId: string, obsId: string, replyId: string) => {
    setCommittedTimeline((prev) => {
      const next = new Map(prev);
      next.set(fileId, (prev.get(fileId) ?? []).map((entry) => removeReplyFromEntry(entry, obsId, replyId)));
      return next;
    });
    setDraftObservations((prev) => {
      const obs = (prev.get(fileId) ?? []).find((o) => o.id === obsId);
      if (!obs) return prev;
      const next = new Map(prev);
      next.set(fileId, (prev.get(fileId) ?? []).map((o) => removeReplyFromObservation(o, obsId, replyId)));
      return next;
    });
    // Persist deletion to per-node forum
    const refs = forumRefMap.get(obsId);
    if (refs && !replyId.startsWith("reply-")) {
      deleteContentForumPost(refs.topicRef, replyId).catch(() => {});
    }
  }, [forumRefMap]);

  const handleCommitReview = useCallback(() => {
    const now = new Date();
    setReviewStatuses((prev) => {
      const next = new Map(prev);
      draftDecisions.forEach((status, id) => next.set(id, status));
      return next;
    });
    setReviewStatusTimestamps((prev) => {
      const next = new Map(prev);
      draftDecisions.forEach((_, id) => next.set(id, now));
      return next;
    });
    if (currentUserName) {
      setReviewStatusUsers((prev) => {
        const next = new Map(prev);
        draftDecisions.forEach((_, id) => next.set(id, currentUserName));
        return next;
      });
    }
    setCommittedTimeline((prev) => {
      const next = new Map(prev);
      draftDecisions.forEach((status, id) => {
        const existing = prev.get(id) ?? [];
        next.set(id, buildCommittedEntry(existing, status, id, now, currentUserName, draftObservations.get(id) ?? []));
      });
      return next;
    });
    setDraftObservations((prev) => {
      const next = new Map(prev);
      draftDecisions.forEach((_, id) => next.delete(id));
      return next;
    });
    const ALFRESCO_STATE_MAP: Record<string, "APPROVED" | "REJECTED" | "PENDING"> = { approved: "APPROVED", rejected: "REJECTED", pending: "PENDING" };
    draftDecisions.forEach((status, id) => {
      const alfrescoState = ALFRESCO_STATE_MAP[status] ?? "PENDING";
      const existing = committedTimeline.get(id) ?? [];
      const looseObs = existing.filter((e) => e.kind === "observation") as LooseObservationTimelineEntry[];
      const allObs = [...looseObs, ...(draftObservations.get(id) ?? [])];
      const reviewComment = allObs
        .map((obs) => `[${obs.type}] ${obs.description}`)
        .join(" | ") || undefined;
      updateBentoReviewState(id, alfrescoState, currentUserName, now.toISOString(), reviewComment).catch(() => {
        toast.error(tr("bento.multimedia.review_state_update_error", dictionary));
      });
      createContentForumTopic(toNodeRef(id), alfrescoState, alfrescoState).catch(() => {});
    });
    setDraftDecisions(new Map());
    setIsCommitModalOpen(false);
    toast.success(tr("bento.multimedia.commit_success", dictionary));
  }, [draftDecisions, currentUserName, draftObservations, committedTimeline, dictionary]);

  const { mutate: globalMutate } = useSWRConfig();

  const packageId = task?.bpm_package
    ? task.bpm_package.split("/")[task.bpm_package.split("/").length - 1]
    : undefined;

  const { data, isLoading, uploadFile, mutate } = useOptimisticFileUpload(packageId);
  const files = useMemo(() => data?.data?.list?.entries || [], [data]);

  const {
    data: documentsData,
    isLoading: documentsIsLoading,
    mutate: mutateContents,
  } = useGetNodeContents(files?.map((file: AlfrescoFileEntry) => file.entry.id) || []);

  useEffect(() => {
    if (files.length > 0 && documentsData) {
      const newImages: any[] = [];
      const newDocuments: any[] = [];
      const loadedStatuses = new Map<string, ReviewStatus>();
      const loadedTimestamps = new Map<string, Date>();
      const loadedUsers = new Map<string, string>();
      documentsData.data.forEach((document: any, index: number) => {
        if (!document.error && files[index]) {
          const entry = files[index] as AlfrescoFileEntry;
          const alfrescoState = entry.entry.properties["mintral:reviewStatus"];
          if (alfrescoState === "APPROVED") loadedStatuses.set(entry.entry.id, "approved");
          else if (alfrescoState === "REJECTED") loadedStatuses.set(entry.entry.id, "rejected");
          else loadedStatuses.set(entry.entry.id, "pending");
          const reviewedAt = entry.entry.properties["mintral:reviewedAt"];
          if (reviewedAt) loadedTimestamps.set(entry.entry.id, new Date(reviewedAt));
          const reviewedBy = entry.entry.properties["mintral:reviewedBy"];
          if (reviewedBy) loadedUsers.set(entry.entry.id, reviewedBy);
          if (entry.entry.content.mimeType.includes("image")) {
            newImages.push({ file: entry, data: document });
          } else {
            newDocuments.push({ file: entry, data: document });
          }
        }
      });
      setImages(newImages);
      setDocuments(newDocuments);
      setReviewStatusTimestamps((prev) => {
        const next = new Map(prev);
        loadedTimestamps.forEach((date, id) => { if (!prev.has(id)) next.set(id, date); });
        return next;
      });
      setReviewStatusUsers((prev) => {
        const next = new Map(prev);
        loadedUsers.forEach((user, id) => { if (!prev.has(id)) next.set(id, user); });
        return next;
      });
      setReviewStatuses((prev) => {
        const next = new Map(prev);
        // Remove stale entries for nodes no longer in the list.
        const liveIds = new Set([...newImages, ...newDocuments].map((item: { file: AlfrescoFileEntry }) => item.file.entry.id));
        next.forEach((_, id) => { if (!liveIds.has(id)) next.delete(id); });
        // Only "approved"/"rejected" from Alfresco override in-memory committed state.
        // A "pending" from Alfresco (absent property) only applies when there is no
        // in-memory decision — this preserves same-session commits while the backend
        // Absence means the property is not yet set; treat as "review" (the default state).
        loadedStatuses.forEach((status, id) => {
          if (status !== "pending" || !prev.has(id)) next.set(id, status);
        });
        return next;
      });
    }
  }, [documentsData, files]);

  // Hydrate committedTimeline from per-node forum discussions
  const [discussionsLoaded, setDiscussionsLoaded] = useState(false);
  useEffect(() => {
    if (allIds.length === 0 || discussionsLoaded) return;
    let cancelled = false;
    async function fetchDiscussions() {
      const results = await Promise.allSettled(
        allIds.map(async (nodeId) => {
          const res = await fetch(`/app/api/forum/content?contentNodeRef=${encodeURIComponent(toNodeRef(nodeId))}`);
          if (!res.ok) return { nodeId, data: null };
          const data = (await res.json()) as ForumDiscussionResponse;
          return { nodeId, data };
        })
      );
      if (cancelled) return;
      const timeline = new Map<string, TimelineEntry[]>();
      const refMap = new Map<string, { topicRef: string; postRef: string }>();
      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value.data) continue;
        const { nodeId, data } = result.value;
        const entries = buildNodeTimeline(data, refMap);
        if (entries.length > 0) timeline.set(nodeId, entries);
      }
      setForumRefMap((prev) => {
        const next = new Map(prev);
        refMap.forEach((v, k) => next.set(k, v));
        return next;
      });
      setCommittedTimeline((prev) => {
        const next = new Map(prev);
        timeline.forEach((entries, nodeId) => {
          if (!prev.has(nodeId)) next.set(nodeId, entries);
        });
        return next;
      });
      setDiscussionsLoaded(true);
    }
    fetchDiscussions();
    return () => { cancelled = true; };
  }, [allIds, discussionsLoaded]);

  const allMediaItems = useMemo<MediaViewerItem[]>(
    () => [
      ...images.map((img) => ({
        type: "image" as const,
        file: img.file as AlfrescoFileEntry,
        refreshKey: imageRefreshKey,
      })),
      ...documents.map((doc) => ({
        type: "document" as const,
        file: doc.file as AlfrescoFileEntry,
      })),
    ],
    [images, documents, imageRefreshKey]
  );

  const viewerItems = useMemo<MediaViewerItem[]>(
    () => allMediaItems.filter((item) => {
      const s = reviewStatuses.get(item.file.entry.id) ?? "pending";
      return viewMode === "approved" ? s === "approved" : s !== "approved";
    }),
    [allMediaItems, viewMode, reviewStatuses]
  );

  const openViewer = useCallback(
    (index: number) => {
      setViewerIndex(index);
      onRequestExpand?.();
    },
    [onRequestExpand]
  );

  const openViewerByFileId = useCallback((fileId: string) => {
    const idx = viewerItems.findIndex((item) => item.file.entry.id === fileId);
    if (idx !== -1) openViewer(idx);
  }, [viewerItems, openViewer]);

  const closeViewer = useCallback(() => {
    setViewerIndex(null);
    onRequestCollapse?.();
  }, [onRequestCollapse]);

  const handleReplaceImage = useCallback(
    async (file: File, index: number) => {
      const item = viewerItems[index];
      if (!item?.file?.entry?.id) {
        toast.error(tr("bento.multimedia.update_error", dictionary));
        return;
      }
      const nodeId = item.file.entry.id;
      setIsUpdatingImage(true);
      const updatePromise = putBentoMultimedia(nodeId, file).then((result) => {
        if (!result.success) throw new Error("Update failed");
        return result;
      });
      toast.promise(updatePromise, {
        loading: tr("bento.multimedia.update_loading", dictionary),
        success: tr("bento.multimedia.update_success", dictionary),
        error: tr("bento.multimedia.update_error", dictionary),
      });
      try {
        await updatePromise;
        await mutate();
        await mutateContents();
        if (item.type === "image") {
          await globalMutate(`/app/api/bento/thumbnails?nodeId=${nodeId}`);
          setImageRefreshKey((prev) => prev + 1);
        }
      } finally {
        setIsUpdatingImage(false);
        setEditImageIndex(null);
      }
    },
    [viewerItems, dictionary, mutate, mutateContents, globalMutate]
  );

  const handleDeleteMedia = useCallback(
    async (index: number) => {
      const item = viewerItems[index];
      if (!item?.file?.entry?.id) return;
      const nodeId = item.file.entry.id;
      const deletePromise = deleteBentoMultimedia(nodeId);
      toast.promise(deletePromise, {
        loading: tr("bento.multimedia.delete_loading", dictionary),
        success: tr("bento.multimedia.delete_success", dictionary),
        error: tr("bento.multimedia.delete_error", dictionary),
      });
      try {
        await deletePromise;
        await mutate();
        await mutateContents();
        if (viewerItems.length <= 1) closeViewer();
      } catch {
        // error toast already shown
      }
    },
    [viewerItems, mutate, mutateContents, closeViewer]
  );

  if (!packageId) return null;

  if (
    (isLoading || documentsIsLoading) &&
    images.length === 0 &&
    documents.length === 0
  ) {
    return <div className="flex flex-col relative bg-gray-200 dark:bg-gray-700 w-full h-full animate-pulse rounded-lg" />;
  }

  // Expanded inline viewer mode — fade in after container expansion (500ms) is mostly done
  if (isExpanded && viewerIndex !== null) {
    return (
      <div
        className="w-full h-full animate-fade-in-opacity"
        style={{ animationDelay: "350ms", opacity: 0 }}
      >
        <MediaInlineViewer
          items={viewerItems}
          initialIndex={viewerIndex}
          onClose={closeViewer}
          reviewStatuses={reviewStatuses}
          draftDecisions={draftDecisions}
          onStatusChange={handleStatusChange}
          onEdit={(i) => setEditImageIndex(i)}
          onDelete={handleDeleteMedia}
          onRename={async () => { await mutate(); await mutateContents(); }}
          onCategoryChanged={async () => { await mutate(); await mutateContents(); }}
          currentTaskServiceCode={task?.mintral_serviceCode}
          draftObservations={draftObservations}
          committedTimeline={committedTimeline}
          onAddObservation={handleAddObservation}
          onRemoveDraftObservation={handleRemoveDraftObservation}
          onRemoveCommittedObservation={handleRemoveCommittedObservation}
          onAddReply={handleAddReply}
          onRemoveReply={handleRemoveReply}
          dictionary={dictionary}
        />
        <ReplaceImageModal
          show={editImageIndex !== null && !isUpdatingImage}
          onClose={() => setEditImageIndex(null)}
          onReplace={(file) => {
            if (editImageIndex !== null) handleReplaceImage(file, editImageIndex);
          }}
          dictionary={dictionary}
          imageName={editImageIndex === null ? undefined : viewerItems[editImageIndex]?.file?.entry?.name}
          accept={editImageIndex !== null && viewerItems[editImageIndex]?.type === "document" ? ".pdf" : ".jpg,.jpeg,.png"}
        />
      </div>
    );
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (isDocumentListOpen || isClasificationFormOpen || isFetchingFromUrl) return;
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      const validFiles = filterValidFiles(Array.from(e.dataTransfer.files), dictionary);
      if (!validFiles) return;
      setUploadableFiles(validFiles);
      setIsClasificationFormOpen(true);
      return;
    }
    const imageUrl = extractImageUrlFromDrop(e.dataTransfer);
    if (!imageUrl) return;
    if (!isValidImageUrl(imageUrl)) {
      alert(tr("bento.multimedia.only_jpg_jpeg_png_pdf_allowed", dictionary));
      return;
    }
    setIsFetchingFromUrl(true);
    try {
      const file = await fetchImageAsFile(imageUrl);
      if (file) {
        setUploadableFiles([file]);
        setIsClasificationFormOpen(true);
      } else {
        alert(tr("bento.multimedia.fetch_image_error", dictionary));
      }
    } finally {
      setIsFetchingFromUrl(false);
    }
  };

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden relative"
      onDragEnter={(e) => {
        e.preventDefault();
        if (isClasificationFormOpen || isDocumentListOpen) return;
        setIsDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (isClasificationFormOpen || isDocumentListOpen) return;
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (isClasificationFormOpen || isDocumentListOpen) return;
        setIsDragOver(false);
      }}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <div
        className={`absolute inset-0 z-20 rounded-lg bg-blue-500/30 border-2 border-blue-400 pointer-events-none transition-opacity duration-200 ${
          isDragOver ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* URL fetch spinner */}
      {isFetchingFromUrl && (
        <div className="absolute top-2 right-2 z-30">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <input
        type="file"
        id="file-input"
        className="hidden"
        multiple
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const validFiles = filterValidFiles(Array.from(e.target.files), dictionary);
            if (!validFiles) return;
            setIsClasificationFormOpen(true);
            setUploadableFiles(validFiles);
          }
        }}
      />

      {/* Unified media card */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 shadow-sm overflow-hidden">

            {/* Shared header */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 justify-between p-2 shrink-0 bg-gray-50 dark:bg-gray-700/60 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-300 uppercase tracking-wide shrink-0">
                {tr("bento.multimedia.title", dictionary)}
                <span className="ml-1.5 font-medium text-gray-400 dark:text-gray-500 normal-case tracking-normal">
                  ({reviewSummary.approved}/{allIds.length})
                </span>
              </span>

              {/* View toggle */}
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("approved")}
                  className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === "approved"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {tr("bento.multimedia.tab_approved", dictionary)}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("review")}
                  className={`relative flex items-center gap-1.5 px-3 py-1 text-xs font-medium border-l border-gray-200 dark:border-gray-600 transition-colors cursor-pointer ${
                    viewMode === "review"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {tr("bento.multimedia.tab_review", dictionary)}
                  {(reviewSummary.pending > 0 || reviewSummary.rejected > 0 || draftDecisions.size > 0) && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${viewMode === "review" ? "bg-amber-300" : "bg-amber-400"}`} />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  color="alternative"
                  onClick={() => document.getElementById("file-input")?.click()}
                  className="p-2 py-1! h-7 text-xs! gap-1"
                >
                  <MdOutlineFileUpload className="w-3.5 h-3.5 mr-1" />
                  {tr("bento.multimedia.btn_upload", dictionary)}
                </Button>
                <Button
                  color="alternative"
                  disabled={selectedIds.size === 0}
                  onClick={() => document.getElementById("file-input")?.click()}
                  className="p-2 py-1! h-7 text-xs! gap-1"
                >
                  <HiArrowDownTray className="w-3.5 h-3.5" />
                  {tr("bento.multimedia.btn_download", dictionary)}
                </Button>
                <div className="flex items-center self-center px-1">
                  <Checkbox
                    title={tr("bento.multimedia.select_all", dictionary)}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => {
                      setSelectedIds(e.target.checked ? new Set(allIds) : new Set());
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">

              {/* Images sub-section */}
              <MediaSection
                label={tr("bento.multimedia.gallery", dictionary)}
                filteredCount={filteredImages.length}
                isExpanded={isImagesExpanded}
                onToggleExpanded={() => setIsImagesExpanded((p) => !p)}
                checkboxTitle={tr("bento.multimedia.select_all_images", dictionary)}
                allItemIds={images.map((img) => img.file.entry.id)}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                emptyText={tr("bento.multimedia.noImages", dictionary)}
              >
                {filteredImages.map(({ img: image, idx: originalIndex }) => (
                  <MediaRow
                    key={image.file.entry.id}
                    file={image.file}
                    index={originalIndex}
                    type="image"
                    onSelect={() => openViewerByFileId(image.file.entry.id)}
                    isSelected={selectedIds.has(image.file.entry.id)}
                    onToggleSelect={toggleSelect}
                    status={draftDecisions.get(image.file.entry.id) ?? reviewStatuses.get(image.file.entry.id) ?? "pending"}
                    statusSetAt={reviewStatusTimestamps.get(image.file.entry.id)}
                    statusSetBy={reviewStatusUsers.get(image.file.entry.id)}
                    hideStatusDot={viewMode === "approved"}
                    dictionary={dictionary}
                  />
                ))}
              </MediaSection>
              {/* Documents sub-section */}
              <MediaSection
                label={tr("bento.multimedia.documents", dictionary)}
                filteredCount={filteredDocuments.length}
                isExpanded={isDocumentsExpanded}
                onToggleExpanded={() => setIsDocumentsExpanded((p) => !p)}
                checkboxTitle={tr("bento.multimedia.select_all_docs", dictionary)}
                allItemIds={documents.map((doc: { file: AlfrescoFileEntry }) => doc.file.entry.id)}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                emptyText={tr("bento.multimedia.noDocuments", dictionary)}
              >
                {filteredDocuments.map(({ doc, idx: originalIndex }) => (
                  <MediaRow
                    key={doc.file.entry.id}
                    file={doc.file}
                    index={originalIndex}
                    type="document"
                    onSelect={() => openViewerByFileId(doc.file.entry.id)}
                    isSelected={selectedIds.has(doc.file.entry.id)}
                    onToggleSelect={toggleSelect}
                    status={draftDecisions.get(doc.file.entry.id) ?? reviewStatuses.get(doc.file.entry.id) ?? "pending"}
                    statusSetAt={reviewStatusTimestamps.get(doc.file.entry.id)}
                    statusSetBy={reviewStatusUsers.get(doc.file.entry.id)}
                    hideStatusDot={viewMode === "approved"}
                    dictionary={dictionary}
                  />
                ))}
              </MediaSection>

            </div>

            {/* Card footer — commit review */}
            {allIds.length > 0 && draftDecisions.size > 0 && (
              <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/60">
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {draftChangeSummary.toApproved > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      {draftChangeSummary.toApproved} → {tr("bento.multimedia.status_approved", dictionary)}
                    </span>
                  )}
                  {draftChangeSummary.toRejected > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      {draftChangeSummary.toRejected} → {tr("bento.multimedia.status_rejected", dictionary)}
                    </span>
                  )}
                  {draftChangeSummary.toPending > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      {draftChangeSummary.toPending} → {tr("bento.multimedia.status_pending", dictionary)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsCommitModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  {tr("bento.multimedia.btn_commit_review", dictionary)}
                </button>
              </div>
            )}
          </div>

      {/* Commit confirmation modal */}
      <Modal
        dismissible
        show={isCommitModalOpen}
        onClose={() => setIsCommitModalOpen(false)}
        size="md"
        theme={{
          content: {
            base: "relative w-full p-4 md:h-auto",
            inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
          },
          header: {
            base: "flex items-center justify-between rounded-t border-b p-4 pb-0 dark:border-gray-600",
            title: "text-base font-semibold text-gray-900 dark:text-white",
            close: { base: "hidden" },
          },
          body: {
            base: "flex-1 overflow-auto pt-4 px-4 pb-4",
          },
        }}
      >
        <ModalHeader className="border-none">
          <div className="flex flex-col">
            <span className="text-base font-semibold">{tr("bento.multimedia.commit_title", dictionary)}</span>
            <span className="text-sm text-gray-500 mt-1 font-normal">
              {tr("bento.multimedia.commit_desc", dictionary)}
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {Array.from(draftDecisions.entries()).map(([id, newStatus]) => {
                const item = allMediaItems.find((m) => m.file.entry.id === id);
                const name = item?.file.entry.name ?? id;
                const currentStatus = reviewStatuses.get(id) ?? "pending";
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="truncate flex-1 text-gray-700 dark:text-gray-300 font-medium">{name}</span>
                    <span className={`flex items-center gap-1 shrink-0 ${statusColorCls(currentStatus)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotCls(currentStatus)}`} />
                      <span className="text-xs">{tr(statusLabelKey(currentStatus), dictionary)}</span>
                    </span>
                    <span className="text-gray-400 text-xs shrink-0">→</span>
                    <span className={`flex items-center gap-1 shrink-0 ${statusColorCls(newStatus)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotCls(newStatus)}`} />
                      <span className="text-xs font-semibold">{tr(statusLabelKey(newStatus), dictionary)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-2">
              <Button
                color="blue"
                onClick={handleCommitReview}
              >
                {tr("bento.multimedia.btn_confirm", dictionary)}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* Modals */}
      <ReplaceImageModal
        show={editImageIndex !== null && !isUpdatingImage}
        onClose={() => setEditImageIndex(null)}
        onReplace={(file) => {
          if (editImageIndex !== null) handleReplaceImage(file, editImageIndex);
        }}
        dictionary={dictionary}
        imageName={editImageIndex === null ? undefined : viewerItems[editImageIndex]?.file?.entry?.name}
        accept={editImageIndex !== null && viewerItems[editImageIndex]?.type === "document" ? ".pdf" : ".jpg,.jpeg,.png"}
      />

      <FileViewer
        selected={selectedDocument}
        setSelected={setSelectedDocument}
        dictionary={dictionary}
      />

      {isClasificationFormOpen && (
        <ClasificationForm
          packageId={packageId}
          setIsOpen={setIsClasificationFormOpen}
          uploadableFiles={uploadableFiles}
          dictionary={dictionary}
          setUploadableFiles={setUploadableFiles}
          uploadFile={uploadFile}
          onUploadComplete={() => setUploadableFiles([])}
        />
      )}

      {isDocumentListOpen && (
        <DocumentList
          setIsOpen={setIsDocumentListOpen}
          documents={documents}
          setSelectedDocument={setSelectedDocument}
          dictionary={dictionary}
        />
      )}
    </div>
  );
}

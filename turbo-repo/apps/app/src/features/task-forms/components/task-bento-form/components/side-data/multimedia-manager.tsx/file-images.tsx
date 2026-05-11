"use client";

import { Button, Checkbox, Modal, ModalHeader, ModalBody, ModalFooter } from "flowbite-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { MdOutlineFileUpload } from "react-icons/md";
import { HiChevronDown, HiArrowDownTray, HiCheck, HiXMark, HiExclamationTriangle } from "react-icons/hi2";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useSession } from "next-auth/react";
import {
  useGetNodeContents,
  useOptimisticFileUpload,
  putBentoMultimedia,
} from "@/features/common/providers/client-api.provider";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ClasificationForm from "./clasification-form";
import FileViewer from "./file_viewer";
import DocumentList from "./document-list";
import { AlfrescoFileEntry } from "./image.types";
import ReplaceImageModal from "@/features/geographic-view/components/image-viewer/replace-image-modal";
import MediaInlineViewer, { MediaViewerItem } from "./media-inline-viewer";
import MediaRow, { ReviewStatus } from "./media-row";

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
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);

  const reviewSummary = useMemo(() => {
    const approved = allIds.filter((id) => reviewStatuses.get(id) === "approved").length;
    const rejected = allIds.filter((id) => reviewStatuses.get(id) === "rejected").length;
    const pending  = allIds.filter((id) => (reviewStatuses.get(id) ?? "pending") === "pending").length;
    return { approved, rejected, pending };
  }, [allIds, reviewStatuses]);


  // Inline viewer state
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerMode, setViewerMode] = useState<"browse" | "confirm">("browse");

  const { data: session } = useSession();
  const currentUserName = session?.user?.name ?? session?.user?.email ?? undefined;

  const handleStatusChange = useCallback((id: string, status: ReviewStatus) => {
    setReviewStatuses((prev) => new Map(prev).set(id, status));
    setReviewStatusTimestamps((prev) => new Map(prev).set(id, new Date()));
    if (currentUserName) {
      setReviewStatusUsers((prev) => new Map(prev).set(id, currentUserName));
    }
  }, [currentUserName]);

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
      documentsData.data.forEach((document: any, index: number) => {
        if (!document.error && files[index]) {
          if (files[index].entry.content.mimeType.includes("image")) {
            newImages.push({ file: files[index], data: document });
          } else {
            newDocuments.push({ file: files[index], data: document });
          }
        }
      });
      setImages(newImages);
      setDocuments(newDocuments);
    }
  }, [documentsData, files]);

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

  const openViewer = useCallback(
    (index: number, mode: "browse" | "confirm" = "browse") => {
      setViewerIndex(index);
      setViewerMode(mode);
      onRequestExpand?.();
    },
    [onRequestExpand]
  );

  const closeViewer = useCallback(() => {
    setViewerIndex(null);
    onRequestCollapse?.();
  }, [onRequestCollapse]);

  const handleReplaceImage = useCallback(
    async (file: File, index: number) => {
      const imageToReplace = images[index];
      if (!imageToReplace?.file?.entry?.id) {
        toast.error(tr("bento.multimedia.update_error", dictionary));
        return;
      }
      const nodeId = imageToReplace.file.entry.id;
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
        await globalMutate(`/app/api/bento/thumbnails?nodeId=${nodeId}`);
        setImageRefreshKey((prev) => prev + 1);
      } finally {
        setIsUpdatingImage(false);
        setEditImageIndex(null);
      }
    },
    [images, dictionary, mutate, mutateContents, globalMutate]
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
          items={allMediaItems}
          initialIndex={viewerIndex}
          onClose={closeViewer}
          showConfirmActions={viewerMode === "confirm"}
          reviewStatuses={reviewStatuses}
          onStatusChange={handleStatusChange}
          onEdit={(i) => setEditImageIndex(i)}
          dictionary={dictionary}
        />
        <ReplaceImageModal
          show={editImageIndex !== null && !isUpdatingImage}
          onClose={() => setEditImageIndex(null)}
          onReplace={(file) => {
            if (editImageIndex !== null) handleReplaceImage(file, editImageIndex);
          }}
          dictionary={dictionary}
          imageName={editImageIndex === null ? undefined : images[editImageIndex]?.file?.entry?.name}
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
            <div className="flex items-center gap-2 px-2 py-1.5 shrink-0 bg-gray-50 dark:bg-gray-700/60 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide shrink-0">
                Multimedia
                <span className="ml-1.5 font-medium text-gray-400 dark:text-gray-500 normal-case tracking-normal">
                  ({allIds.length})
                </span>
              </span>
              {reviewSummary.pending > 0 && (
                <button
                  type="button"
                  onClick={() => openViewer(0, "confirm")}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs font-medium">{reviewSummary.pending} pending</span>
                </button>
              )}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => document.getElementById("file-input")?.click()}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                >
                  <MdOutlineFileUpload className="w-3.5 h-3.5" />
                  <span className="text-xs">Upload or drop</span>
                </button>
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                    selectedIds.size > 0
                      ? "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                      : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <HiArrowDownTray className="w-3.5 h-3.5" />
                  <span className="text-xs">Download</span>
                </button>
                <div className="flex items-center self-center px-1">
                  <Checkbox
                    title="Select all"
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
              <div className="flex flex-col">
                <div className="flex items-center sticky top-0 z-10 bg-gray-50/60 dark:bg-gray-800/80 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setIsImagesExpanded((p) => !p)}
                    className="flex items-center gap-2 flex-1 px-2 py-2 text-left group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors min-w-0"
                  >
                    <HiChevronDown
                      className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200 shrink-0 ${
                        isImagesExpanded ? "" : "-rotate-90"
                      }`}
                    />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 uppercase tracking-wider transition-colors">
                      {tr("bento.multimedia.gallery", dictionary)}
                    </span>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                      ({images.length})
                    </span>
                  </button>
                  <div className="px-2 shrink-0 " onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      title="Select all images"
                      checked={images.length > 0 && images.every((img) => selectedIds.has(img.file.entry.id))}
                      ref={(el) => {
                        if (el) {
                          const count = images.filter((img) => selectedIds.has(img.file.entry.id)).length;
                          el.indeterminate = count > 0 && count < images.length;
                        }
                      }}
                      onChange={(e) => {
                        const ids = images.map((img) => img.file.entry.id);
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) { ids.forEach((id) => next.add(id)); }
                          else { ids.forEach((id) => next.delete(id)); }
                          return next;
                        });
                      }}
                    />
                  </div>
                </div>

                {isImagesExpanded && (
                  <div className="flex flex-col gap-0.5 py-1 px-1">
                    {images.length > 0 ? (
                      images.map((image, index) => (
                        <MediaRow
                          key={image.file.entry.id}
                          file={image.file}
                          index={index}
                          type="image"
                          onSelect={(i) => openViewer(i, "browse")}
                          isSelected={selectedIds.has(image.file.entry.id)}
                          onToggleSelect={toggleSelect}
                          status={reviewStatuses.get(image.file.entry.id) ?? "pending"}
                          statusSetAt={reviewStatusTimestamps.get(image.file.entry.id)}
                          statusSetBy={reviewStatusUsers.get(image.file.entry.id)}
                          dictionary={dictionary}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-2">
                        {tr("bento.multimedia.noImages", dictionary)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-600" />

              {/* Documents sub-section */}
              <div className="flex flex-col">
                <div className="flex items-center sticky top-0 z-10 bg-gray-50/60 dark:bg-gray-800/80 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setIsDocumentsExpanded((p) => !p)}
                    className="flex items-center gap-2 flex-1 px-2 py-2 text-left group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors min-w-0"
                  >
                    <HiChevronDown
                      className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200 shrink-0 ${
                        isDocumentsExpanded ? "" : "-rotate-90"
                      }`}
                    />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 uppercase tracking-wider transition-colors">
                      {tr("bento.multimedia.documents", dictionary)}
                    </span>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                      ({documents.length})
                    </span>
                  </button>
                  <div className="px-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      title="Select all documents"
                      checked={documents.length > 0 && documents.every((doc: { file: AlfrescoFileEntry }) => selectedIds.has(doc.file.entry.id))}
                      ref={(el) => {
                        if (el) {
                          const count = documents.filter((doc: { file: AlfrescoFileEntry }) => selectedIds.has(doc.file.entry.id)).length;
                          el.indeterminate = count > 0 && count < documents.length;
                        }
                      }}
                      onChange={(e) => {
                        const ids = documents.map((doc: { file: AlfrescoFileEntry }) => doc.file.entry.id);
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) { ids.forEach((id) => next.add(id)); }
                          else { ids.forEach((id) => next.delete(id)); }
                          return next;
                        });
                      }}
                    />
                  </div>
                </div>

                {isDocumentsExpanded && (
                  <div className="flex flex-col gap-0.5 py-1 px-1">
                    {documents.length > 0 ? (
                      documents.map((doc: { file: AlfrescoFileEntry }, docIndex: number) => (
                        <MediaRow
                          key={doc.file.entry.id}
                          file={doc.file}
                          index={docIndex}
                          type="document"
                          onSelect={(i) => openViewer(images.length + i, "browse")}
                          isSelected={selectedIds.has(doc.file.entry.id)}
                          onToggleSelect={toggleSelect}
                          status={reviewStatuses.get(doc.file.entry.id) ?? "pending"}
                          statusSetAt={reviewStatusTimestamps.get(doc.file.entry.id)}
                          statusSetBy={reviewStatusUsers.get(doc.file.entry.id)}
                          dictionary={dictionary}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-2">
                        {tr("bento.multimedia.noDocuments", dictionary)}
                      </p>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Card footer — commit review */}
            {allIds.length > 0 && (
              <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/60">
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    {reviewSummary.approved} approved
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    {reviewSummary.rejected} rejected
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    {reviewSummary.pending} pending
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCommitModalOpen(true)}
                  disabled={reviewSummary.approved === 0 && reviewSummary.rejected === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Commit review
                </button>
              </div>
            )}
          </div>

      {/* Commit confirmation modal */}
      <Modal show={isCommitModalOpen} onClose={() => setIsCommitModalOpen(false)} size="md">
        <ModalHeader>Submit review</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to submit your review? This action will apply the following decisions:
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <HiCheck className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  {reviewSummary.approved} {reviewSummary.approved === 1 ? "file" : "files"} approved
                </span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <HiXMark className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  {reviewSummary.rejected} {reviewSummary.rejected === 1 ? "file" : "files"} rejected
                </span>
              </div>
              {reviewSummary.pending > 0 && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <HiExclamationTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {reviewSummary.pending} {reviewSummary.pending === 1 ? "file" : "files"} still pending — no decision will be applied to them
                  </span>
                </div>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-2 w-full">
            <Button color="gray" onClick={() => setIsCommitModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={() => {
                setIsCommitModalOpen(false);
                toast.success("Review submitted successfully");
              }}
            >
              Confirm
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Modals */}
      <ReplaceImageModal
        show={editImageIndex !== null && !isUpdatingImage}
        onClose={() => setEditImageIndex(null)}
        onReplace={(file) => {
          if (editImageIndex !== null) handleReplaceImage(file, editImageIndex);
        }}
        dictionary={dictionary}
        imageName={editImageIndex === null ? undefined : images[editImageIndex]?.file?.entry?.name}
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

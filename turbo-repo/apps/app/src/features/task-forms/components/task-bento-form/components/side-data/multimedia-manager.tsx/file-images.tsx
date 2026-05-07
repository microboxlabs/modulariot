"use client";

import { Button } from "flowbite-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { MdOutlineFileUpload } from "react-icons/md";
import { HiChevronDown } from "react-icons/hi2";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
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
import MediaRow from "./media-row";

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

  // Inline viewer state
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerMode, setViewerMode] = useState<"browse" | "confirm">("browse");

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

  const pendingCount = allMediaItems.length;

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

  // Expanded inline viewer mode
  if (isExpanded && viewerIndex !== null) {
    return (
      <MediaInlineViewer
        items={allMediaItems}
        initialIndex={viewerIndex}
        onClose={closeViewer}
        showConfirmActions={viewerMode === "confirm"}
        dictionary={dictionary}
      />
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

      {/* Pending confirmation badge — matches symptoms timeline amber style */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between px-2 py-1.5 mb-1 rounded-lg bg-amber-500/15 border border-amber-200 dark:border-amber-700 shrink-0 gap-2">
          <span className="text-xs font-medium text-amber-900 dark:text-amber-100 truncate">
            {pendingCount} {pendingCount === 1 ? "file" : "files"} waiting for confirmation
          </span>
          <button
            type="button"
            onClick={() => openViewer(0, "confirm")}
            className="text-xs font-semibold text-amber-900 dark:text-amber-100 underline underline-offset-2 shrink-0"
          >
            View
          </button>
        </div>
      )}

      {/* Upload zone */}
      <div
        className={`flex items-center justify-center gap-3 px-2 py-2 rounded-lg border border-dashed shrink-0 transition-colors ${
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
        }`}
      >
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tr("bento.multimedia.subtitle", dictionary)}
        </span>
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
        <Button
          color="blue"
          size="xs"
          onClick={() => document.getElementById("file-input")?.click()}
          className="shrink-0"
        >
          <div className="flex items-center gap-1">
            <MdOutlineFileUpload className="w-3 h-3" />
            {tr("bento.multimedia.upload", dictionary)}
          </div>
        </Button>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-2 flex flex-col gap-1">

        {/* Images section */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setIsImagesExpanded((p) => !p)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg transition-colors text-left shrink-0 group cursor-pointer"
          >
            <HiChevronDown
              className={`w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200 shrink-0 ${
                isImagesExpanded ? "" : "-rotate-90"
              }`}
            />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 uppercase tracking-wide transition-colors">
              {tr("bento.multimedia.gallery", dictionary)}
            </span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
              ({images.length})
            </span>
          </button>

          {isImagesExpanded && (
            <div className="flex flex-col gap-0.5 px-1">
              {images.length > 0 ? (
                images.map((image, index) => (
                  <MediaRow
                    key={image.file.entry.id}
                    file={image.file}
                    index={index}
                    type="image"
                    onSelect={(i) => openViewer(i, "browse")}
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

        {/* Documents section */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setIsDocumentsExpanded((p) => !p)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg transition-colors text-left shrink-0 group cursor-pointer"
          >
            <HiChevronDown
              className={`w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200 shrink-0 ${
                isDocumentsExpanded ? "" : "-rotate-90"
              }`}
            />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 uppercase tracking-wide transition-colors">
              {tr("bento.multimedia.documents", dictionary)}
            </span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
              ({documents.length})
            </span>
          </button>

          {isDocumentsExpanded && (
            <div className="flex flex-col gap-0.5 px-1">
              {documents.length > 0 ? (
                documents.map((doc: { file: AlfrescoFileEntry }, docIndex: number) => (
                  <MediaRow
                    key={doc.file.entry.id}
                    file={doc.file}
                    index={docIndex}
                    type="document"
                    onSelect={(i) => openViewer(images.length + i, "browse")}
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

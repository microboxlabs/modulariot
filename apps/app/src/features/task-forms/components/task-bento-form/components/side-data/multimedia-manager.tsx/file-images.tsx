"use client";

import { Button, FileInput } from "flowbite-react";
import { useState, useEffect, useMemo } from "react";
import { IoDocumentTextOutline, IoImagesOutline } from "react-icons/io5";
import { MdOutlineFileUpload } from "react-icons/md";
import {
  useGetNodeContents,
  useOptimisticFileUpload,
} from "@/features/common/providers/client-api.provider";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import Document from "../document";
import ClasificationForm from "./clasification-form";
import FileViewer from "./file_viewer";
import DocumentList from "./document-list";
import { AlfrescoFileEntry } from "./image.types";
import ImageElement from "./image-element";
import ImageViewerConnector from "./image-viewer-connector";
import ReplaceImageModal from "@/features/geographic-view/components/image-viewer/replace-image-modal";

export const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

function filterValidFiles(
  files: File[],
  dictionary: I18nRecord
): File[] | null {
  const validFiles = files.filter((file) => ALLOWED_FILE_TYPES.has(file.type));
  if (validFiles.length !== files.length) {
    alert(tr("bento.multimedia.only_jpg_jpeg_png_pdf_allowed", dictionary));
    return null;
  }
  return validFiles;
}

export function extractImageUrlFromDrop(
  dataTransfer: DataTransfer
): string | null {
  // Try to get URL from text/uri-list (most common for dragged images)
  const uriList = dataTransfer.getData("text/uri-list");
  if (uriList) {
    const urls = uriList
      .split("\n")
      .filter((url) => url.trim() && !url.startsWith("#"));
    if (urls.length > 0) return urls[0];
  }

  // Try to get URL from text/plain
  const plainText = dataTransfer.getData("text/plain");
  if (
    plainText &&
    (plainText.startsWith("http://") || plainText.startsWith("https://"))
  ) {
    return plainText;
  }

  // Try to extract image URL from HTML (for some browsers)
  const html = dataTransfer.getData("text/html");
  if (html) {
    const srcMatch = /src=["']([^"']+)["']/.exec(html);
    if (srcMatch?.[1]) {
      return srcMatch[1];
    }
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

    // Validate mime type
    if (!blob.type.startsWith("image/")) return null;
    if (!ALLOWED_FILE_TYPES.has(blob.type)) return null;

    // Extract filename from URL or generate one
    const urlPath = new URL(imageUrl).pathname;
    const urlFilename = urlPath.split("/").pop() || "";
    const extension = blob.type.split("/")[1] || "jpg";
    const filename = urlFilename.includes(".")
      ? urlFilename
      : `downloaded-image-${Date.now()}.${extension}`;

    return new File([blob], filename, { type: blob.type });
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export default function FileImages({
  task,
  dictionary,
}: Readonly<{
  task: TaskResponse | null;
  dictionary: I18nRecord;
}>) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFetchingFromUrl, setIsFetchingFromUrl] = useState(false);
  const [isClasificationFormOpen, setIsClasificationFormOpen] = useState(false);
  const [isDocumentListOpen, setIsDocumentListOpen] = useState(false);
  const [uploadableFiles, setUploadableFiles] = useState<any[]>([]);
  const [editImageIndex, setEditImageIndex] = useState<number | null>(null);

  const [images, setImages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  const packageId = task?.bpm_package
    ? task.bpm_package.split("/")[task.bpm_package.split("/").length - 1]
    : undefined;

  // Use the optimistic upload hook instead of the basic one
  const { data, isLoading, uploadFile } = useOptimisticFileUpload(packageId);

  const files = useMemo(() => data?.data?.list?.entries || [], [data]);

  // Classify files by mimeType from the listing metadata (no content download needed)
  useEffect(() => {
    if (files.length > 0) {
      const newImages: any[] = [];
      const newDocuments: any[] = [];

documentsData.data.forEach((document: any, index: number) => {
        if (!document.error && files[index]) {
          if (files[index].entry.content.mimeType.includes("image")) {
            console.log("Image data:", files[index]);
            newImages.push({
              file: files[index],
              data: document,
            });
          } else {
            newDocuments.push({
              file: files[index],
              data: document,
            });
          }
        }
      });

      setImages(newImages);
      setDocuments(newDocuments);
    }
  }, [files]);

  if (!packageId) {
    return null;
  }

  // Only show loading skeleton while data is being fetched
  if (isLoading && !data) {
    return (
      <div className="flex flex-col relative bg-gray-200 dark:bg-gray-700 w-full h-[650px] animate-pulse rounded-lg" />
    );
  }

  return (
    <div
      className="h-full w-full flex flex-col relative"
      onDragEnter={(e) => {
        e.preventDefault();
        if (isClasificationFormOpen || isDocumentListOpen) {
          return;
        }
        setIsDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (isClasificationFormOpen || isDocumentListOpen) {
          return;
        }
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (isClasificationFormOpen || isDocumentListOpen) {
          return;
        }
        setIsDragOver(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        if (
          isDocumentListOpen ||
          isClasificationFormOpen ||
          isFetchingFromUrl
        ) {
          return;
        }

        setIsDragOver(false);

        // First try to handle as regular files (from filesystem)
        if (e.dataTransfer.files.length > 0) {
          const validFiles = filterValidFiles(
            Array.from(e.dataTransfer.files),
            dictionary
          );
          if (!validFiles) return;

          setUploadableFiles(validFiles);
          setIsClasificationFormOpen(true);
          return;
        }

        // If no files, try to extract image URL (dragged from web)
        const imageUrl = extractImageUrlFromDrop(e.dataTransfer);
        if (!imageUrl) return;

        if (!isValidImageUrl(imageUrl)) {
          alert(
            tr("bento.multimedia.only_jpg_jpeg_png_pdf_allowed", dictionary)
          );
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
      }}
    >
      {/* Drag and drop overlay */}
      <div
        className={`absolute hidden top-0 left-0 w-full h-full flex items-center justify-center rounded-lg bg-blue-500/40 z-20 transition-all duration-300 ${
          isDragOver ? "animate-fade-in-fast" : "animate-fade-out-fast"
        }`}
      />
      {/* Small loading indicator for URL fetch */}
      {isFetchingFromUrl && (
        <div className="absolute top-2 right-2 z-30">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div
        className={`flex w-full p-2 flex-col items-center justify-center rounded-lg border-2 border-dashed ${
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
            : "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700"
        } ${
          images.length === 0 && documents.length === 0 ? "h-[650px]" : "h-full"
        }`}
      >
        <div className="flex flex-col items-center justify-center pb-6 pt-5 gap-2">
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg text-gray-500 dark:text-gray-100">
              {tr("bento.multimedia.title", dictionary)}
            </p>
            <p className="text-sm font-light text-gray-500 dark:text-gray-400">
              <span className=" text-gray-700 dark:text-gray-200">
                {tr("bento.multimedia.subtitle", dictionary)}
              </span>
            </p>
          </div>
          <div className="relative">
            <input
              type="file"
              id="file-input"
              className="hidden"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const validFiles = filterValidFiles(
                    Array.from(e.target.files),
                    dictionary
                  );
                  if (!validFiles) return;

                  setIsClasificationFormOpen(true);
                  setUploadableFiles(validFiles);
                }
              }}
            />
            <Button
              color="blue"
              // className="flex flex-row items-center justify-center gap-2 bg-blue-500 text-white p-2 rounded-lg text-sm font-light hover:bg-blue-600 cursor-pointer"
              onClick={() => {
                document.getElementById("file-input")?.click();
              }}
            >
              <div className="flex flex-row items-center justify-center gap-2">
                <MdOutlineFileUpload className="w-3 h-3" />
                {tr("bento.multimedia.upload", dictionary)}
              </div>
            </Button>
          </div>
        </div>

        <FileInput id="dropzone-file" className="hidden" />

        {/* Images */}
        <div
          className={`gap-2 flex flex-col duration-300 rounded-lg relative mt-4 w-full ${
            images.length == 0 && documents.length == 0
              ? "hidden"
              : "block"
          }`}
        >
          <div className="flex flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("bento.multimedia.gallery", dictionary)} ({images.length}{" "}
              {tr("bento.multimedia.elements", dictionary)})
            </p>
            <Button
              onClick={() => setSelectedImage(0)}
              className={`${
                images.length == 0 ? "hidden" : "block"
              } text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed [&>span]:p-0`}
            >
              {tr("bento.multimedia.viewMore", dictionary)}
            </Button>
          </div>
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative h-80">
              {images.slice(0, 4).map((image, index: number) => (
                <ImageElement
                  key={image.file.entry.id}
                  file={image.file}
                  index={index}
                  setSelectedImage={setSelectedImage}
                  dictionary={dictionary}
                  onEdit={(idx) => {
                    setEditImageIndex(idx);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 h-80 flex flex-col items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg">
              <IoImagesOutline className="w-10 h-10" />
              {tr("bento.multimedia.noImages", dictionary)}
            </div>
          )}
        </div>

        {/* Documents */}
        <div
          className={`gap-2 flex flex-col duration-300 rounded-lg relative mt-4 w-full ${
            documents.length == 0 && images.length == 0
              ? "hidden"
              : "block"
          }`}
        >
          <div className="flex flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("bento.multimedia.documents", dictionary)} ({documents.length}{" "}
              {tr("bento.multimedia.elements", dictionary)})
            </p>
            <Button
              color="link"
              onClick={() => setIsDocumentListOpen(true)}
              className={`${
                documents.length == 0 ? "hidden" : "block"
              } text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed [&>span]:p-0`}
            >
              {tr("bento.multimedia.viewMore", dictionary)}
            </Button>
          </div>
          {documents.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative h-40">
              {documents.slice(0, 4).map((document: any) => (
                <Document
                  key={document.file.entry.id}
                  document={document}
                  setSelected={setSelectedDocument}
                  dictionary={dictionary}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 h-[9.5rem] flex flex-col items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg">
              <IoDocumentTextOutline className="w-10 h-10" />
              {tr("bento.multimedia.noDocuments", dictionary)}
            </div>
          )}
        </div>
        {/* Image Viewer */}
        <ImageViewerConnector
          images={images}
          selected={selectedImage}
          setSelected={setSelectedImage}
          dictionary={dictionary}
          onReplaceImage={(file, index) => {
            console.log(
              "Replace image:",
              file,
              "at index:",
              index,
              "for image:",
              images[index]
            );
            // TODO: Implement actual image replacement logic
          }}
        />

        {/* Standalone Replace Image Modal (from thumbnail edit button) */}
        <ReplaceImageModal
          show={editImageIndex !== null}
          onClose={() => setEditImageIndex(null)}
          onReplace={(file) => {
            if (editImageIndex !== null) {
              console.log(
                "Replace image:",
                file,
                "at index:",
                editImageIndex,
                "for image:",
                images[editImageIndex]
              );
              // TODO: Implement actual image replacement logic
              setEditImageIndex(null);
            }
          }}
          dictionary={dictionary}
          imageName={
            editImageIndex !== null
              ? images[editImageIndex]?.file?.entry?.name
              : undefined
          }
        />

        <FileViewer
          selected={selectedDocument}
          setSelected={setSelectedDocument}
          dictionary={dictionary}
        />
      </div>

      {/* Clasification Form */}
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

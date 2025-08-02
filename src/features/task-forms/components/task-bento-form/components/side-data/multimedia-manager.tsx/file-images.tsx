"use client";

import { Button, FileInput } from "flowbite-react";
import Document from "../document";
import { useState, useEffect } from "react";
import { IoDocumentTextOutline, IoImagesOutline } from "react-icons/io5";
import { FaUpload } from "react-icons/fa";
import ClasificationForm from "./clasification-form";
import {
  useGetNodeChildren,
  useGetNodeContents,
} from "@/features/common/providers/client-api.provider";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import FileViewer from "./file_viewer";
import DocumentList from "./document-list";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { AlfrescoFileEntry } from "./image.types";
import ImageElement from "./image-element";
import ImageViewerConnector from "./image-viewer-connector";
import { tr } from "@/features/i18n/tr.service";

export default function FileImages({
  task,
  dictionary,
}: {
  task: TaskResponse | null;
  dictionary: I18nRecord;
}) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isClasificationFormOpen, setIsClasificationFormOpen] = useState(false);
  const [isDocumentListOpen, setIsDocumentListOpen] = useState(false);
  const [uploadableFiles, setUploadableFiles] = useState<any[]>([]);

  const [images, setImages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  const packageId =
    task?.bpm_package!.split("/")[task.bpm_package!.split("/").length - 1];

  const {
    data,
    error: _childrenError,
    isLoading: _childrenIsLoading,
    mutate,
  } = useGetNodeChildren(packageId);

  const files = data?.data?.list?.entries || [];

  const {
    data: documentsData,
    error: _documentsError,
    isLoading: documentsIsLoading,
  } = useGetNodeContents(
    files?.map((file: AlfrescoFileEntry) => file.entry.id) || [],
  );

  // Process documents data when it changes
  useEffect(() => {
    if (files.length > 0 && documentsData) {
      const newImages: any[] = [];
      const newDocuments: any[] = [];

      documentsData.data.forEach((document: any, index: number) => {
        if (!document.error && files[index]) {
          if (files[index].entry.content.mimeType.includes("image")) {
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
  }, [documentsData, files]);

  if (!packageId) {
    return null;
  }

  if (documentsIsLoading) {
    return (
      <div className="flex flex-col relative bg-gray-50 dark:bg-gray-700 w-full h-[650px] animate-pulse rounded-lg"></div>
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
      onDrop={(e) => {
        e.preventDefault();
        if (isDocumentListOpen || isClasificationFormOpen) {
          return;
        }

        setIsDragOver(false);
        setUploadableFiles(Array.from(e.dataTransfer.files));
        setIsClasificationFormOpen(true);
      }}
    >
      {/* Drag and drop overlay */}
      <div
        className={`absolute top-0 left-0 w-full h-full flex items-center justify-center rounded-lg bg-blue-500/40 z-20 transition-all duration-300 ${
          isDragOver ? "animate-fade-in-fast" : "animate-fade-out-fast"
        }`}
      ></div>
      <div
        className={`flex w-full p-2 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed ${
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
            : "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700"
        } ${images.length === 0 && documents.length === 0 ? "h-[650px]" : "h-full"}`}
      >
        <div className="flex flex-col items-center justify-center pb-6 pt-5 gap-2">
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg text-gray-500 dark:text-gray-100">
              {tr(
                "title",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              )}
            </p>
            <p className="text-sm font-light text-gray-500 dark:text-gray-400">
              <span className=" text-gray-700 dark:text-gray-200">
                {tr(
                  "subtitle",
                  ((dictionary as I18nRecord).bento as I18nRecord)
                    .multimedia as I18nRecord,
                )}
              </span>
            </p>
          </div>
          <div className="relative">
            <input
              type="file"
              id="file-input"
              className="hidden"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setIsClasificationFormOpen(true);
                  setUploadableFiles(Array.from(e.target.files));
                }
              }}
            />
            <Button
              theme={{
                size: {
                  md: "h-5 px-2 text-sm",
                },
              }}
              color="blue"
              className="flex flex-row items-center justify-center gap-2 bg-blue-500 text-white p-2 rounded-lg text-sm font-light hover:bg-blue-600 cursor-pointer"
              onClick={() => {
                document.getElementById("file-input")?.click();
              }}
            >
              <div className="flex flex-row items-center justify-center gap-2">
                <FaUpload className="w-3 h-3" />
                {tr(
                  "upload",
                  ((dictionary as I18nRecord).bento as I18nRecord)
                    .multimedia as I18nRecord,
                )}
              </div>
            </Button>
          </div>
        </div>

        <FileInput id="dropzone-file" className="hidden" />

        {/* Images */}
        <div
          className={`gap-2 flex flex-col duration-300 rounded-lg relative mt-4 w-full ${
            images.length == 0 && documents.length == 0 ? "hidden" : "block"
          }`}
        >
          <div className="flex flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr(
                "gallery",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              )}{" "}
              ({images.length}{" "}
              {tr(
                "elements",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              )}
              )
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setSelectedImage(0);
              }}
              className={`${
                images.length == 0 ? "hidden" : "block"
              } text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed`}
            >
              {tr(
                "viewMore",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              )}
            </a>
          </div>
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative h-80">
              {images.slice(0, 4).map((image, index: number) => (
                <ImageElement
                  key={image.file.entry.id}
                  file={image.file}
                  index={index}
                  setSelectedImage={setSelectedImage}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 h-80 flex flex-col items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg">
              <IoImagesOutline className="w-10 h-10" />
              {tr(
                "noImages",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              )}
            </div>
          )}
        </div>

        {/* Documents */}
        <div
          className={`gap-2 flex flex-col duration-300 rounded-lg relative mt-4 w-full ${
            documents.length == 0 && images.length == 0 ? "hidden" : "block"
          }`}
        >
          <div className="flex flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr(
                "documents",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              )}{" "}
              ({documents.length}{" "}
              {tr(
                "elements",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              )}
              )
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setIsDocumentListOpen(true);
              }}
              className={`${
                documents.length == 0 ? "hidden" : "block"
              } text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed`}
            >
              {tr(
                "viewMore",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              )}
            </a>
          </div>
          {documents.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative h-40">
              {documents.slice(0, 4).map((document: any) => (
                <Document
                  key={document.file.entry.id}
                  document={document}
                  setSelected={setSelectedDocument}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 h-[9.5rem] flex flex-col items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg">
              <IoDocumentTextOutline className="w-10 h-10" />
              {tr(
                "noDocuments",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              )}
            </div>
          )}
        </div>
        {/* Image Viewer */}
        <ImageViewerConnector
          images={images}
          selected={selectedImage}
          setSelected={setSelectedImage}
        />

        <FileViewer
          selected={selectedDocument}
          setSelected={setSelectedDocument}
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
          mutate={mutate}
        />
      )}
      {isDocumentListOpen && (
        <DocumentList
          setIsOpen={setIsDocumentListOpen}
          documents={documents}
          setSelectedDocument={setSelectedDocument}
        />
      )}
    </div>
  );
}

export function displayBase64Content(
  base64Content: string,
  mimeType: string,
): string {
  return `data:${mimeType};base64,${base64Content}`;
}

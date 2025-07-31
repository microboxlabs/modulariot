import { Button, FileInput } from "flowbite-react";
import Document from "../document";
import { useState } from "react";
import { IoDocumentTextOutline, IoImagesOutline } from "react-icons/io5";
import { FaUpload } from "react-icons/fa";
import ClasificationForm from "./clasification-form";
import { useGetNodeChildren } from "@/features/common/providers/client-api.provider";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import FileViewer from "./file_viewer";
import DocumentList from "./document-list";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { AlfrescoFileEntry } from "./image.types";
import ImageElement from "./image-element";
import ImageViewerConnector from "./image-viewer-connector";

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

  const packageId =
    task?.bpm_package!.split("/")[task.bpm_package!.split("/").length - 1];

  const { data, error, isLoading } = useGetNodeChildren(packageId ?? "");

  if (!task || !packageId || error) {
    return null;
  }

  const files = data?.data.list.entries;

  // Filter files based on MIME type
  const images =
    files?.filter((file: AlfrescoFileEntry) =>
      file.entry.content.mimeType.includes("image"),
    ) || [];

  const documents =
    files?.filter(
      (file: AlfrescoFileEntry) =>
        !file.entry.content.mimeType.includes("image"),
    ) || [];

  if (isLoading) {
    return (
      <div className="flex flex-col relative bg-gray-50 dark:bg-gray-700 w-full h-[650px] animate-pulse rounded-lg"></div>
    );
  }

  return (
    <div
      className="h-full w-full flex flex-col relative"
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (isClasificationFormOpen) {
          return;
        }
        setIsDragOver(false);
        setIsClasificationFormOpen(true);
        setUploadableFiles(Array.from(e.dataTransfer.files));
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
              Multimedia
            </p>
            <p className="text-sm font-light text-gray-500 dark:text-gray-400">
              <span className=" text-gray-700 dark:text-gray-200">
                Drag and drop a file here or
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
                <FaUpload className="w-3 h-3" /> Subir documento
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
              Galeria ({images.length} elementos)
            </p>
            <div
              className={`${
                images.length == 0 ? "hidden" : "block"
              } text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed`}
            >
              Ver mas
            </div>
          </div>
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative h-80">
              {images
                .slice(0, 4)
                .map((file: AlfrescoFileEntry, index: number) => (
                  <ImageElement
                    key={file.entry.id}
                    file={file}
                    index={index}
                    setSelectedImage={setSelectedImage}
                    isLoading={isLoading}
                  />
                ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 h-80 flex flex-col items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg">
              <IoImagesOutline className="w-10 h-10" />
              No hay imagenes
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
              Documentos ({documents.length} elementos)
            </p>
            <div
              className={`${
                documents.length == 0 ? "hidden" : "block"
              } text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed`}
              onClick={() => setIsDocumentListOpen(true)}
            >
              Ver mas
            </div>
          </div>
          {documents.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative h-40">
              {documents.slice(0, 4).map((file: AlfrescoFileEntry) => (
                <Document
                  key={file.entry.id}
                  file={file}
                  setSelected={setSelectedDocument}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 h-[9.5rem] flex flex-col items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg">
              <IoDocumentTextOutline className="w-10 h-10" />
              No hay documentos
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
          setIsOpen={setIsClasificationFormOpen}
          uploadableFiles={uploadableFiles}
          setUploadableFiles={setUploadableFiles}
          dictionary={dictionary}
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

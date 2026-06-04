import { Button, Modal, ModalBody, ModalHeader } from "flowbite-react";
import { MdOutlineFileUpload } from "react-icons/md";
import { HiTrash } from "react-icons/hi2";
import { toast } from "sonner";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useState } from "react";

interface ReplaceImageModalProps {
  show: boolean;
  onClose: () => void;
  onReplace: (file: File) => void;
  dictionary: I18nRecord;
  imageName?: string;
  accept?: string;
}

export default function ReplaceImageModal({
  show,
  onClose,
  onReplace,
  dictionary,
  imageName,
  accept = ".jpg,.jpeg,.png",
}: Readonly<ReplaceImageModalProps>) {
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleClose = () => {
    setReplaceFile(null);
    setIsDragOver(false);
    onClose();
  };

  const handleReplace = () => {
    if (!replaceFile) {
      toast.error(tr("bento.multimedia.noFileSelected", dictionary));
      return;
    }
    onReplace(replaceFile);
    setReplaceFile(null);
    setIsDragOver(false);
  };

  return (
    <Modal
      dismissible
      show={show}
      onClose={handleClose}
      size="xl"
      className="z-[900]"
      theme={{
        content: {
          base: "relative w-full p-4 md:h-auto",
          inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
        },
        header: {
          base: "flex items-center justify-between rounded-t border-b p-5 dark:border-gray-600",
          close: {
            base: "hidden",
          },
        },
        body: {
          base: "flex-1 overflow-auto px-5 pb-5",
        },
      }}
    >
      <ModalHeader className="border-none">
        <div className="flex flex-col">
          <span className="text-base font-semibold">
            {tr("bento.multimedia.replaceImage", dictionary)}
          </span>
          <span className="text-sm text-gray-500 mt-1 font-normal">
            {tr("bento.multimedia.replaceImageDescription", dictionary)}
          </span>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          {/* Drag and Drop Zone */}
          <label
            htmlFor="replace-file-input"
            className={`flex w-full p-6 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer ${
              isDragOver
                ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                : "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700"
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
              const files = Array.from(e.dataTransfer.files);
              const allowedTypes = new Set(
                accept.split(",").flatMap((ext) => {
                  const e = ext.trim().replace(".", "").toLowerCase();
                  if (e === "pdf") return ["application/pdf"];
                  if (e === "jpg" || e === "jpeg") return ["image/jpeg", "image/jpg"];
                  if (e === "png") return ["image/png"];
                  return [];
                })
              );
              const validFile = files.find((file) =>
                allowedTypes.has(file.type)
              );
              if (validFile) {
                setReplaceFile(validFile);
              } else {
                toast.error(
                  tr("bento.multimedia.only_jpg_jpeg_png_allowed", dictionary)
                );
              }
            }}
          >
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
                <MdOutlineFileUpload className="w-6 h-6 text-gray-500 dark:text-gray-300" />
              </div>
              <div className="flex flex-col items-center justify-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {tr("bento.multimedia.subtitle", dictionary)}
                </p>
              </div>
              <input
                type="file"
                id="replace-file-input"
                className="hidden"
                accept={accept}
                aria-label={tr("bento.multimedia.selectFile", dictionary)}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setReplaceFile(e.target.files[0]);
                  }
                }}
              />
              <span className="flex flex-row items-center justify-center gap-2 text-white bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg">
                <MdOutlineFileUpload className="w-4 h-4" />
                {tr("bento.multimedia.selectFile", dictionary)}
              </span>
            </div>
          </label>

          {/* Selected file preview */}
          {replaceFile && (
            <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {replaceFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(replaceFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplaceFile(null)}
                className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors duration-200 cursor-pointer"
              >
                <HiTrash className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button color="blue" onClick={handleReplace}>
              {tr("bento.multimedia.replaceImage", dictionary)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

import { Button, Modal, ModalBody } from "flowbite-react";
import { MdOutlineFileDownload, MdOutlineFileUpload } from "react-icons/md";
import { FaShare } from "react-icons/fa";
import Carousel from "../carousel";
import { toast } from "sonner";
import { getCategories } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/clasification-form";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { downloadImage } from "../../utils/download-image";
import { useState } from "react";
import ReplaceImageModal from "./replace-image-modal";

const modalTheme = {
  root: {
    base: "fixed inset-0 z-50 h-full w-full overflow-hidden",
    sizes: {
      "7xl": "max-w-none",
    },
  },
  content: {
    base: "relative w-[80%] h-[80%] md:h-[80%] p-0",
    inner:
      "relative flex flex-col h-full max-h-none bg-white dark:bg-gray-700 rounded-lg border border-gray-800 overflow-hidden",
  },
  body: {
    base: "flex flex-col flex-1 overflow-hidden p-0",
  },
};

// This component is the general image displayer
export default function ImageViewer({
  images,
  selected,
  setSelected,
  data = [],
  dictionary,
  onReplaceImage,
}: Readonly<{
  images: string[];
  selected: number | null;
  setSelected: (index: number | null) => void;
  data?: {
    tag?: string;
    name: string;
    modifiedAt?: string;
    modifiedByUser?: { id: string; displayName: string };
  }[];
  dictionary: I18nRecord;
  onReplaceImage?: (file: File, index: number) => void;
}>) {
  const [showReplaceModal, setShowReplaceModal] = useState(false);

  const handleReplaceModalClose = () => {
    setShowReplaceModal(false);
  };
  const handleShare = async () => {
    if (!navigator.share || selected === null) {
      console.error("Sharing is not supported on this device/browser");
      return;
    }

    // Helper function to check if a string is a valid URL (not a blob URL)
    const isValidUrl = (urlString: string): boolean => {
      try {
        const url = new URL(urlString);
        // Check if it's a blob URL (starts with blob:)
        if (url.protocol === "blob:") {
          return false;
        }
        // Check for common URL protocols
        return ["http:", "https:", "ftp:", "ftps:"].includes(url.protocol);
      } catch {
        return false;
      }
    };

    if (isValidUrl(images[selected])) {
      try {
        await navigator.share({
          title: "Vista geográfica",
          text: "Compartir la vista geográfica",
          url: images[selected],
        });
        toast.success("Imagen compartida");
      } catch (error) {
        // Don't show error for user cancellation
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Share error:", error);
        toast.error("Error al compartir imagen");
      }
    } else {
      try {
        const response = await fetch(images[selected]);
        const blob = await response.blob();
        const newFile = new File([blob], "imagen.png", {
          type: blob.type || "image/png",
        });

        await navigator.share({
          title: "Vista geográfica",
          text: "Compartir la vista geográfica",
          files: [newFile],
        });

        toast.success("Imagen compartida");
      } catch (error) {
        // Don't show error for user cancellation
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Share error:", error);
        toast.error("Error al compartir imagen");
      }
    }
  };

  const categories = getCategories(dictionary);

  return (
    <>
      <Modal
        dismissible
        show={selected !== null}
        onClose={() => setSelected(null)}
        size="7xl"
        theme={modalTheme}
        className="z-[800] backdrop-blur-[10px]"
      >
        <ModalBody>
          <div className="relative flex flex-col items-center justify-center gap-2 bg-gray-300 dark:bg-gray-600 rounded-t-lg shadow-lg w-full h-full flex-1 min-h-0 overflow-hidden">
            {selected !== null && (
              <Carousel
                images={images}
                selected={selected}
                setSelected={setSelected}
              />
            )}
          </div>
          {selected !== null && (
            <div className="w-full flex-shrink-0 flex justify-between items-center text-white transition-all duration-300 gap-2 p-2 min-h-0">
              <div className="text-gray-500 dark:text-gray-300 text-sm font-light flex flex-row items-center gap-2 min-w-0 flex-1 px-2 py-1 overflow-hidden">
                <div className="text-gray-500 dark:text-gray-300 text-sm font-light truncate">
                  {data[selected]?.name}
                </div>
                <div className="text-gray-500 dark:text-gray-300 text-sm rounded-full bg-gray-200 dark:bg-gray-800 font-light px-2 py-1 flex-shrink-0">
                  {categories[data[selected]?.tag as keyof typeof categories]
                    ?.label || "Sin categoría"}
                </div>
                {data[selected]?.modifiedAt && (
                  <>
                    <div className="text-gray-500 dark:text-gray-300 text-sm rounded-full bg-gray-200 dark:bg-gray-800 font-light px-2 py-1 flex-shrink-0">
                      {data[selected]?.modifiedByUser?.id}
                    </div>
                    <div className="text-gray-500 dark:text-gray-300 text-sm rounded-full bg-gray-200 dark:bg-gray-800 font-light px-2 py-1 flex-shrink-0">
                      {new Date(data[selected].modifiedAt).toLocaleString()}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {onReplaceImage && (
                  <Button
                    color="blue"
                    onClick={() => setShowReplaceModal(true)}
                    pill
                    size="sm"
                  >
                    <MdOutlineFileUpload className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  color="blue"
                  onClick={async () => {
                    if (selected === null) return;
                    try {
                      await downloadImage(images[selected], dictionary);
                      toast.success("Imagen descargada");
                    } catch (error) {
                      console.error("Download error:", error);
                      toast.error("Error al descargar imagen");
                    }
                  }}
                  pill
                  size="sm"
                >
                  <MdOutlineFileDownload className="w-4 h-4" />
                </Button>
                <Button
                  color="blue"
                  onClick={() => handleShare()}
                  pill
                  size="sm"
                >
                  <FaShare className="h-4 w-4 text-white text-center" />
                </Button>
              </div>
            </div>
          )}
        </ModalBody>
      </Modal>

      {/* Replace Image Modal */}
      <ReplaceImageModal
        show={showReplaceModal}
        onClose={handleReplaceModalClose}
        onReplace={(file) => {
          if (selected !== null && onReplaceImage) {
            onReplaceImage(file, selected);
            handleReplaceModalClose();
          }
        }}
        dictionary={dictionary}
        imageName={selected !== null ? data[selected]?.name : undefined}
      />
    </>
  );
}

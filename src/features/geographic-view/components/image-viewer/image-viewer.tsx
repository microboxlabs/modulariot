import { Button } from "flowbite-react";
import { MdOutlineFileDownload } from "react-icons/md";
import { FaShare } from "react-icons/fa";
import Carousel from "../carousel";
import { toast } from "sonner";
import { getCategories } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/clasification-form";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

// This component is the general image displayer
export default function ImageViewer({
  images,
  selected,
  setSelected,
  data = [],
  dictionary,
}: {
  images: string[];
  selected: number | null;
  setSelected: (index: number | null) => void;
  data?: { tag: string; name: string }[];
  dictionary: I18nRecord;
}) {
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
    <div
      className={`fixed top-0 right-0 left-0 bottom-0 flex justify-center items-center text-white transition-all duration-300 z-50 backdrop-blur-[10px] gap-2 ${selected !== null ? "opacity-100 visible" : "opacity-0 invisible"}`}
      onClick={(e) => {
        // Only close if clicking the background, not the content
        if (e.target === e.currentTarget) {
          setSelected(null);
        }
      }}
    >
      <div
        className="w-[80%] h-[80%] flex flex-col items-center justify-center bg-white dark:bg-gray-700 rounded-lg border border-gray-800 overflow-hidden"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="relative flex flex-col items-center justify-center gap-2 bg-gray-300 dark:bg-gray-600 rounded-t-lg shadow-lg w-full h-full flex-1 overflow-hidden">
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
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                color="blue"
                onClick={(e: any) => {
                  e.stopPropagation();
                  if (!selected) return;
                  const link = document.createElement("a");
                  link.download = `imagen-${new Date().toISOString().slice(0, 10)}.png`;
                  link.href = images[selected];
                  link.click();
                }}
                pill
                size="sm"
              >
                <MdOutlineFileDownload className="w-4 h-4" />
              </Button>
              <Button
                color="blue"
                onClick={(e: any) => {
                  e.stopPropagation();
                  handleShare();
                }}
                pill
                size="sm"
              >
                <FaShare className="h-4 w-4 text-white text-center" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

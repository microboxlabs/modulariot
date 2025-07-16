import { Button } from "flowbite-react";
import { MdOutlineFileDownload } from "react-icons/md";
import { FaShare } from "react-icons/fa";
import Carousel from "../carousel";
import { toast } from "sonner";

// This component is the general image displayer
export default function ImageViewer({
  images,
  selected,
  setSelected,
}: {
  images: string[];
  selected: number | null;
  setSelected: (index: number | null) => void;
}) {
  const handleShare = () => {
    // Basic share implementation (could be expanded)
    if (navigator.share && selected) {
      navigator
        .share({
          title: "Vista geográfica",
          text: "Compartir la vista geográfica",
          url: images[selected],
        })
        .then(() => {
          toast.success("Imagen compartida");
        })
        .catch((error) => {
          console.error("Share error:", error);
          toast.error("Error al compartir imagen");
        });
    } else {
      console.error("Sharing is not supported on this device/browser");
    }
  };

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
        className="w-[80%] h-[80%]"
        onClick={(e) => {
          // Prevent clicks on the content from closing the modal
          e.stopPropagation();
        }}
      >
        <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-700 rounded-lg border border-gray-800 w-full h-full">
          <div className="relative flex flex-col items-center justify-center gap-2 bg-gray-300 dark:bg-gray-600 rounded-t-lg shadow-lg w-full h-full">
            {selected !== null && (
              <Carousel
                images={images}
                selected={selected}
                setSelected={setSelected}
              />
            )}
          </div>
          {selected !== null && (
            <div className="w-full flex justify-between items-center text-white transition-all duration-300 gap-2 p-2">
              <div className="text-gray-500 dark:text-gray-300 text-sm font-light">
                {
                  images[selected]?.split("/")[
                    images[selected]?.split("/").length - 1
                  ]
                }
              </div>
              <div className="flex gap-2">
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
    </div>
  );
}

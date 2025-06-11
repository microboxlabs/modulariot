import { useState, useRef, useEffect } from "react";
import { FaChevronRight, FaShare } from "react-icons/fa";
import { MdOutlineFileDownload, MdOutlineRemoveRedEye } from "react-icons/md";
import Image from "next/image";
import { Button } from "flowbite-react";
import Carousel from "./carousel";
import { toast } from "sonner";

export default function ImageSelector({ images }: { images: string[] }) {
  const [open, setOpen] = useState(true);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkScroll = () => {
      const el = scrollRef.current?.querySelector(".overflow-y-auto");
      if (!el) return;

      const scrollable = el.scrollHeight > el.clientHeight;
      const scrolledToBottom =
        Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

      setCanScrollDown(scrollable && !scrolledToBottom);
    };

    const el = scrollRef.current?.querySelector(".overflow-y-auto");
    if (el) {
      el.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
      // Initial check
      checkScroll();
    }

    return () => {
      if (el) {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      }
    };
  }, [open]);

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
      ref={scrollRef}
      className="h-full bg-white dark:bg-gray-800 pointer-events-auto transition-all duration-300 relative"
    >
      <div
        className={`overflow-y-auto overflow-x-hidden h-full transition-all duration-300 ${open ? "max-w-80 border-r-2 border-gray-300 dark:border-gray-700" : "max-w-0 overflow-hidden"}`}
      >
        {images.map((image, index) => (
          <ImageComponent
            key={index}
            image={image}
            index={index}
            setSelected={setSelected}
          />
        ))}
        {/* Scroll down indicator */}
      </div>
      <div
        className="absolute right-[-2em] z-10 top-1/2 -translate-y-1/2 h-10 w-[2em] bg-white rounded-r-lg px-1 hover:px-2 border-r border-y border-gray-200 flex items-center justify-center cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <FaChevronRight
          className={`w-5 h-5 transition-all duration-300 ${open ? "rotate-180" : ""}`}
        />
      </div>
      <div
        className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-[2] pointer-events-none transition-all ${open ? (canScrollDown ? "opacity-100 duration-500" : "duration-300 opacity-0") : "duration-100 opacity-0"} `}
      >
        <div className="animate-bounce text-gray-400 bg-white rounded-full px-2 py-1 shadow border border-gray-500">
          ↓
        </div>
      </div>
      <div
        className={`fixed top-0 right-0 left-0 bottom-0 opacity-0 flex justify-center items-center text-white transition-all duration-300 visible z-50 backdrop-blur-[10px] gap-2 ${selected !== null ? "animate-show-flex" : "animate-hide-flex"}`}
        onClick={(e) => {
          // Only close if clicking the background, not the content
          if (e.target === e.currentTarget) {
            setSelected(null);
          }
        }}
      >
        <div className="w-[80%] h-[80%]">
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
                    onClick={() => {
                      if (!selected) return;
                      const link = document.createElement("a");
                      link.download = `vista-geografica-${new Date().toISOString().slice(0, 10)}.png`;
                      link.href = images[selected];
                      link.click();
                    }}
                    pill
                    size="sm"
                  >
                    <MdOutlineFileDownload className="w-4 h-4" />
                  </Button>
                  <Button color="blue" onClick={handleShare} pill size="sm">
                    <FaShare className="h-4 w-4 text-white text-center" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageComponent({
  image,
  index,
  setSelected,
}: {
  image: string;
  index: number;
  setSelected: (index: number) => void;
}) {
  return (
    <div>
      <div className="h-40 w-40 flex flex-col items-center justify-center gap-2 border-b-2 border-gray-300 relative">
        <Image
          src={image}
          alt="Image"
          width={160}
          height={160}
          className="object-cover w-full h-full"
        />
        <div className="absolute top-0 right-0 left-0 bottom-0 opacity-0 flex justify-center items-center text-white transition-all duration-300 hover:opacity-100 visible backdrop-blur-[10px] bg-black/30 gap-2">
          <div
            className="flex flex-col items-center justify-center bg-blue-500 rounded-full p-2 hover:bg-blue-600 cursor-pointer transition-all duration-300"
            onClick={() => {
              setSelected(index);
            }}
          >
            <MdOutlineRemoveRedEye className="w-6 h-6" />
          </div>
          <a
            href={image}
            download={image}
            className="flex flex-col items-center justify-center bg-blue-500 rounded-full p-2 hover:bg-blue-600 cursor-pointer transition-all duration-300"
          >
            <MdOutlineFileDownload className="w-6 h-6" />
          </a>
        </div>
      </div>
    </div>
  );
}

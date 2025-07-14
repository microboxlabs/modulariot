import { useState, useRef, useEffect } from "react";
import { FaChevronRight } from "react-icons/fa";
import { MdOutlineFileDownload, MdOutlineRemoveRedEye } from "react-icons/md";
import Image from "next/image";
import ImageViewer from "./image-viewer";

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
      <ImageViewer
        images={images}
        selected={selected}
        setSelected={setSelected}
      />
    </div>
  );
}

export function ImageComponent({
  image,
  index,
  setSelected,
  setSize = "h-40 w-40",
  stepped = true,
}: {
  image: string | null;
  index: number;
  setSelected: (index: number) => void;
  setSize?: string;
  stepped?: boolean;
}) {
  return (
    <div className="overflow-hidden bg-gray-300 dark:bg-gray-600">
      <div
        className={`${setSize} flex flex-col items-center justify-center gap-2 ${stepped ? "border-b-2 border-gray-300" : ""} relative overflow-hidden`}
      >
        {image ? (
          <Image
            src={image}
            alt="Image"
            width={160}
            height={160}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-gray-300 dark:bg-gray-600 overflow-hidden"></div>
        )}
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
            href={image ?? undefined}
            download={image ?? undefined}
            className="flex flex-col items-center justify-center bg-blue-500 rounded-full p-2 hover:bg-blue-600 cursor-pointer transition-all duration-300"
          >
            <MdOutlineFileDownload className="w-6 h-6" />
          </a>
        </div>
      </div>
    </div>
  );
}

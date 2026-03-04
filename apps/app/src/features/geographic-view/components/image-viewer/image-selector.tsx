import { useState, useRef, useEffect } from "react";
import { FaImage, FaPlay, FaPause } from "react-icons/fa";
import { MdOutlineFileDownload, MdOutlineRemoveRedEye } from "react-icons/md";
import Image from "next/image";
import ImageViewer from "./image-viewer";
import VideoViewer from "./video-viewer";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { downloadImage } from "../../utils/download-image";
import { Button } from "flowbite-react";
import type { TimelapseData } from "../../hooks/use-timelapse";

function SprocketStrip() {
  return (
    <div
      className="shrink-0 w-5"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0px, transparent 4px, var(--sprocket-color) 4px, var(--sprocket-color) 12px, transparent 12px, transparent 20px)",
        backgroundSize: "12px 20px",
        backgroundRepeat: "repeat-y",
        backgroundPosition: "center",
      }}
    />
  );
}

function FilmstripFrame({
  image,
  index,
  setSelected,
  dictionary,
}: Readonly<{
  image: string;
  index: number;
  setSelected: (index: number) => void;
  dictionary?: I18nRecord;
}>) {
  return (
    <div className="flex items-stretch px-1 py-2">
      <SprocketStrip />
      <div className="flex-1 mx-1 relative overflow-hidden border border-gray-300 dark:border-gray-600 rounded-sm bg-gray-200 dark:bg-gray-800">
        <div className="relative w-full aspect-[4/3]">
          {image ? (
            <Image
              src={image}
              alt={`Evidence ${index + 1}`}
              width={200}
              height={150}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-300 dark:bg-gray-700">
              <FaImage className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
          )}
          <div className="absolute inset-0 opacity-0 flex justify-center items-center text-white transition-all duration-300 hover:opacity-100 backdrop-blur-[10px] bg-black/30 gap-2">
            <Button
              className="flex flex-col items-center justify-center bg-blue-500 rounded-full p-2 hover:bg-blue-600 cursor-pointer transition-all duration-300"
              onClick={() => setSelected(index)}
            >
              <MdOutlineRemoveRedEye className="w-6 h-6" />
            </Button>
            <Button
              className="flex flex-col items-center justify-center bg-blue-500 rounded-full p-2 hover:bg-blue-600 cursor-pointer transition-all duration-300"
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                  await downloadImage(image, dictionary);
                } catch (error) {
                  console.error("Download error:", error);
                }
              }}
            >
              <MdOutlineFileDownload className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
      <SprocketStrip />
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoFilmstripFrame({
  timelapse,
  onOpenViewer,
}: Readonly<{
  timelapse: TimelapseData;
  onOpenViewer: () => void;
}>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="flex items-stretch px-1 py-2">
      <SprocketStrip />
      <div className="flex-1 mx-1 relative overflow-hidden border border-gray-300 dark:border-gray-600 rounded-sm bg-gray-200 dark:bg-gray-800">
        <button
          type="button"
          className="relative w-full aspect-[4/3] cursor-pointer border-none bg-transparent p-0 block"
          onClick={togglePlay}
        >
          <video
            ref={videoRef}
            src={timelapse.proxyStreamUrl}
            preload="metadata"
            playsInline
            muted
            loop
            className="object-cover w-full h-full"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />

          {/* Paused overlay: play icon + duration */}
          {!playing && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <FaPlay className="w-8 h-8 text-white drop-shadow-lg" />
              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                {formatDuration(timelapse.estimatedDurationSeconds)}
              </div>
            </div>
          )}

          {/* Playing hover overlay: pause icon */}
          {playing && (
            <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/30 flex items-center justify-center transition-opacity duration-200">
              <FaPause className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          )}

          {/* Processing badge */}
          {timelapse.state === "PROCESSING" && (
            <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded font-medium">
              Processing...
            </div>
          )}

          {/* Eye icon overlay on hover */}
          <div className="absolute top-1 right-1 opacity-0 hover:opacity-100 transition-opacity duration-200">
            <Button
              className="bg-blue-500 rounded-full p-1.5 hover:bg-blue-600 cursor-pointer transition-all duration-300"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onOpenViewer();
              }}
            >
              <MdOutlineRemoveRedEye className="w-5 h-5 text-white" />
            </Button>
          </div>
        </button>
      </div>
      <SprocketStrip />
    </div>
  );
}

function scrollIndicatorOpacity(open: boolean, canScrollDown: boolean): string {
  if (!open) return "duration-100 opacity-0";
  return canScrollDown ? "opacity-100 duration-500" : "duration-300 opacity-0";
}

export default function ImageSelector({
  images,
  dictionary,
  timelapse,
}: {
  images: string[];
  dictionary: I18nRecord;
  timelapse?: TimelapseData | null;
}) {
  const [open, setOpen] = useState(true);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showVideoViewer, setShowVideoViewer] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkScroll = () => {
      const el = scrollRef.current;
      if (!el) return;

      const scrollable = el.scrollHeight > el.clientHeight;
      const scrolledToBottom =
        Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

      setCanScrollDown(scrollable && !scrolledToBottom);
    };

    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
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
      className="h-full pointer-events-auto relative flex [--sprocket-color:theme(colors.gray.400)] dark:[--sprocket-color:theme(colors.gray.700)]"
    >
      {/* Filmstrip panel */}
      <div
        className={`h-full bg-gray-100 dark:bg-gray-900 overflow-hidden transition-all duration-500 ease-in-out ${open ? "w-[280px]" : "w-0"}`}
      >
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-900"
        >
          {timelapse && (
            <VideoFilmstripFrame
              timelapse={timelapse}
              onOpenViewer={() => setShowVideoViewer(true)}
            />
          )}
          {images.map((image, index) => (
            <FilmstripFrame
              key={index}
              image={image}
              index={index}
              setSelected={setSelected}
              dictionary={dictionary}
            />
          ))}
        </div>
      </div>

      {/* Grabber tab */}
      <div
        className="absolute right-[-32px] top-4 z-10 w-8 h-10 bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-r-lg flex items-center justify-center cursor-pointer hover:bg-gray-200/90 dark:hover:bg-gray-800/90 transition-colors duration-200"
        onClick={() => setOpen(!open)}
      >
        <div className="flex flex-col gap-[3px]">
          <span className="block w-4 h-[2px] bg-gray-500 dark:bg-gray-400 rounded-full" />
          <span className="block w-4 h-[2px] bg-gray-500 dark:bg-gray-400 rounded-full" />
          <span className="block w-4 h-[2px] bg-gray-500 dark:bg-gray-400 rounded-full" />
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className={`absolute bottom-5 z-[2] pointer-events-none transition-all ${open ? "left-[140px]" : "left-0"} ${scrollIndicatorOpacity(open, canScrollDown)}`}
      >
        <div className="animate-bounce text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-full px-2 py-1 shadow border border-gray-300 dark:border-gray-600">
          ↓
        </div>
      </div>

      <ImageViewer
        images={images}
        selected={selected}
        setSelected={setSelected}
        dictionary={dictionary}
      />

      {timelapse && (
        <VideoViewer
          videoUrl={timelapse.proxyStreamUrl}
          show={showVideoViewer}
          onClose={() => setShowVideoViewer(false)}
          dictionary={dictionary}
        />
      )}
    </div>
  );
}

export function ImageComponent({
  image,
  index,
  setSelected,
  setSize = "h-40 w-40",
  stepped = true,
  loading = false,
  tag = null,
  downloadUrl,
  dictionary,
}: {
  image: string | null;
  index: number;
  setSelected: (index: number) => void;
  setSize?: string;
  stepped?: boolean;
  loading?: boolean;
  tag?: string | null;
  downloadUrl?: string;
  dictionary?: I18nRecord;
}) {
  if (loading) {
    return (
      <div className="overflow-hidden bg-gray-300 dark:bg-gray-600 w-full h-40 animate-pulse"></div>
    );
  }

  return (
    <div className="overflow-hidden bg-gray-300 dark:bg-gray-600 h-40 relative">
      {tag && (
        <div className="whitespace-nowrap bg-gray-200 text-gray-00 dark:text-gray-400 dark:bg-gray-800 px-2 py-1 text-xs w-full absolute top-0 left-0 z-10 flex items-center justify-center">
          {tag}
        </div>
      )}
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
          <div className="w-full h-full bg-gray-300 dark:bg-gray-600 overflow-hidden flex items-center justify-center">
            {" "}
            <FaImage className="w-8 h-8 object-cover text-gray-500 dark:text-gray-400" />{" "}
          </div>
        )}
        <div className="absolute top-0 right-0 left-0 bottom-0 opacity-0 flex justify-center items-center text-white transition-all duration-300 hover:opacity-100 visible backdrop-blur-[10px] bg-black/30 gap-2">
          <Button
            className="flex flex-col items-center justify-center bg-blue-500 rounded-full p-2 hover:bg-blue-600 cursor-pointer transition-all duration-300"
            onClick={() => {
              setSelected(index);
            }}
          >
            <MdOutlineRemoveRedEye className="w-6 h-6" />
          </Button>
          {(downloadUrl || image) && (
            <Button
              className="flex flex-col items-center justify-center bg-blue-500 rounded-full p-2 hover:bg-blue-600 cursor-pointer transition-all duration-300"
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                  if (downloadUrl) {
                    await downloadImage(downloadUrl, dictionary);
                  } else if (image) {
                    await downloadImage(image, dictionary);
                  }
                } catch (error) {
                  console.error("Download error:", error);
                  if (image) {
                    await downloadImage(image, dictionary);
                  }
                }
              }}
            >
              <MdOutlineFileDownload className="w-6 h-6" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

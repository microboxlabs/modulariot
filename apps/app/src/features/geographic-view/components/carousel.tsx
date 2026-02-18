import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function Carousel({
  images,
  selected,
  setSelected,
}: Readonly<{
  images: string[];
  selected: number;
  setSelected: (index: number) => void;
}>) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [imageRect, setImageRect] = useState<DOMRect | null>(null);
  const activeImageRef = useRef<HTMLImageElement | null>(null);
  const loadedImagesCount = useRef(0);

  const zoomLevel = 2.5;
  const lensSize = 250;

  useEffect(() => {
    if (imagesLoaded) {
      scrollToPosition();
    }
  }, [imagesLoaded]);

  const scrollToPosition = () => {
    if (!carouselRef.current) return;
    const targetPosition = selected * carouselRef.current.clientWidth;

    carouselRef.current.scrollTo({
      left: targetPosition,
      behavior: "smooth",
    });
  };

  // Handle scroll
  useEffect(() => {
    if (imagesLoaded) {
      scrollToPosition();
    }
  }, [selected]);

  const handleImageLoad = () => {
    loadedImagesCount.current += 1;
    if (loadedImagesCount.current === images.length) {
      setImagesLoaded(true);
    }
  };

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (zoomActive) {
        setZoomActive(false);
        setImageRect(null);
        activeImageRef.current = null;
      } else {
        const img = e.currentTarget.querySelector("img");
        if (!img) return;
        activeImageRef.current = img;
        setImageRect(img.getBoundingClientRect());
        setZoomPosition({ x: e.clientX, y: e.clientY });
        setZoomActive(true);
      }
    },
    [zoomActive]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (zoomActive && imageRect) {
        setZoomPosition({ x: e.clientX, y: e.clientY });
      }
    },
    [zoomActive, imageRect]
  );

  // Disable zoom when changing slides
  useEffect(() => {
    setZoomActive(false);
    setImageRect(null);
    activeImageRef.current = null;
  }, [selected]);

  return (
    <div
      className="flex flex-row gap-2 w-full h-full"
      onMouseMove={handleMouseMove}
    >
      <div
        ref={carouselRef}
        className="flex flex-row overflow-x-hidden h-full w-full scrollbar-hide"
        id="carousel"
      >
        {/* left arrow */}
        <div
          className="absolute z-10 left-5 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/30 hover:bg-white/50 backdrop-blur-[10px] rounded-full flex flex-row gap-2 cursor-pointer text-gray-700 justify-center items-center select-none"
          onClick={() => {
            if (selected > 0) {
              setSelected(selected - 1);
            } else {
              setSelected(images.length - 1);
            }
          }}
        >
          <FaChevronLeft />
        </div>
        {/* right arrow */}
        <div
          className="absolute z-10 right-5 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/30 hover:bg-white/50 backdrop-blur-[10px] rounded-full flex flex-row gap-2 cursor-pointer text-gray-700 justify-center items-center select-none"
          onClick={() => {
            if (selected < images.length - 1) {
              setSelected(selected + 1);
            } else {
              setSelected(0);
            }
          }}
        >
          <FaChevronRight />
        </div>
        {/* images */}
        {images.map((image, index) => (
          <div
            key={index}
            className="shrink-0 w-full h-full flex items-center justify-center relative"
          >
            <button
              type="button"
              onClick={handleImageClick}
              aria-pressed={zoomActive}
              aria-label={zoomActive ? "Disable zoom" : "Enable zoom"}
              className={`bg-transparent border-0 p-0 m-0 outline-none max-h-full ${zoomActive ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            >
              <Image
                src={image}
                alt="Image"
                width={1200}
                height={1200}
                className="max-h-full w-auto object-contain select-none pointer-events-none"
                onLoad={handleImageLoad}
              />
            </button>
          </div>
        ))}
        {/* indicators */}

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-row gap-2 backdrop-blur-[10px] bg-white/50 p-2 rounded-full">
          {images.length < 8 ? (
            <div className="w-full h-full flex flex-row gap-2">
              {images.map((_image, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full cursor-pointer transition-all duration-300 select-none ${selected === index ? "bg-gray-500" : "bg-gray-200 hover:bg-gray-100"}`}
                  onClick={() => setSelected(index)}
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full">
              {selected + 1} / {images.length}
            </div>
          )}
        </div>
      </div>

      {/* Magnifier Lens */}
      {zoomActive && imageRect && (
        <div
          className="pointer-events-none fixed z-50 overflow-hidden rounded-lg border-2 border-white/50 shadow-xl"
          style={{
            width: lensSize,
            height: lensSize,
            left: zoomPosition.x - lensSize / 2,
            top: zoomPosition.y - lensSize / 2,
          }}
        >
          <div
            style={{
              width: imageRect.width * zoomLevel,
              height: imageRect.height * zoomLevel,
              backgroundImage: `url(${images[selected]})`,
              backgroundSize: `${imageRect.width * zoomLevel}px ${imageRect.height * zoomLevel}px`,
              backgroundPosition: `-${(zoomPosition.x - imageRect.left) * zoomLevel - lensSize / 2}px -${(zoomPosition.y - imageRect.top) * zoomLevel - lensSize / 2}px`,
              backgroundRepeat: "no-repeat",
            }}
            className="h-full w-full"
          />
        </div>
      )}
    </div>
  );
}

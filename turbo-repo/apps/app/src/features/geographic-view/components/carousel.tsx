import { useEffect, useRef } from "react";
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

  const scrollToPosition = () => {
    if (!carouselRef.current) return;
    const targetPosition = selected * carouselRef.current.clientWidth;

    carouselRef.current.scrollTo({
      left: targetPosition,
      behavior: "smooth",
    });
  };

  // Handle scroll when selected changes
  useEffect(() => {
    scrollToPosition();
  }, [selected]);

  return (
    <section
      aria-label="Image carousel"
      className="flex flex-row gap-2 w-full h-full"
    >
      <div
        ref={carouselRef}
        className="flex flex-row overflow-x-hidden h-full w-full scrollbar-hide"
        id="carousel"
      >
        {/* left arrow */}
        <button
          type="button"
          aria-label="Previous image"
          className="absolute z-10 left-5 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/30 hover:bg-white/50 backdrop-blur-[10px] rounded-full flex flex-row gap-2 cursor-pointer text-gray-700 justify-center items-center select-none border-0"
          onClick={() => {
            if (selected > 0) {
              setSelected(selected - 1);
            } else {
              setSelected(images.length - 1);
            }
          }}
        >
          <FaChevronLeft />
        </button>
        {/* right arrow */}
        <button
          type="button"
          aria-label="Next image"
          className="absolute z-10 right-5 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/30 hover:bg-white/50 backdrop-blur-[10px] rounded-full flex flex-row gap-2 cursor-pointer text-gray-700 justify-center items-center select-none border-0"
          onClick={() => {
            if (selected < images.length - 1) {
              setSelected(selected + 1);
            } else {
              setSelected(0);
            }
          }}
        >
          <FaChevronRight />
        </button>
        {/* images */}
        {images.map((image, index) => (
          <div
            key={image}
            className="shrink-0 w-full h-full flex items-center justify-center relative"
          >
            <Image
              src={image}
              alt="Image"
              width={1200}
              height={1200}
              draggable={false}
              className="max-h-full w-auto object-contain select-none"
              unoptimized
            />
          </div>
        ))}
        {/* indicators */}

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-row gap-2 backdrop-blur-[10px] bg-white/50 p-2 rounded-full">
          {images.length < 8 ? (
            <div className="w-full h-full flex flex-row gap-2">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={image}
                  aria-label={`Go to image ${index + 1}`}
                  className={`w-3 h-3 rounded-full cursor-pointer transition-all duration-300 select-none border-0 p-0 ${selected === index ? "bg-gray-500" : "bg-gray-200 hover:bg-gray-100"}`}
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
    </section>
  );
}

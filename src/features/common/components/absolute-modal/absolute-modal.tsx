import React, { useRef } from "react";

export default function AbsoluteModal({
  children,
  selected,
  setSelected,
  maxWidth,
  maxHeight,
  height,
  className,
}: {
  children: React.ReactNode;
  selected: any;
  setSelected: (selected: any) => void;
  maxWidth?: string;
  maxHeight?: string;
  height?: string;
  className?: string;
}) {
  // Track if mousedown started on backdrop to prevent closing when selecting text
  const mouseDownOnBackdrop = useRef(false);

  return (
    <div
      className={`no-drag fixed top-0 right-0 left-0 bottom-0 flex justify-center items-center text-white transition-all duration-300 z-50 w-full h-full backdrop-blur-[10px] gap-2 px-4 ${selected ? "opacity-100 visible" : "opacity-0 invisible"}`}
      role="button"
      tabIndex={0}
      onMouseDown={(e) => {
        // Track if mousedown started on the backdrop itself
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only close if both mousedown AND click happened on the backdrop
        // This prevents closing when selecting text and dragging outside
        if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
          setSelected(null);
        }
        mouseDownOnBackdrop.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSelected(null);
        }
      }}
      aria-label="Close modal"
    >
      <div
        className={`flex flex-col items-center justify-center overflow-hidden  ${className || "bg-white dark:bg-gray-700 rounded-lg border border-gray-800"}`}
        style={{
          maxWidth: maxWidth || "100%",
          maxHeight: maxHeight || "100%",
          height: height || "",
        }}
      >
        {children}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

  // Renders in a portal to document.body so its z-800 backdrop escapes any
  // ancestor with `isolation: isolate` (e.g. the kanban board wrapper) —
  // isolate unconditionally boxes descendants into a local stacking context,
  // capping z-800 there and letting anything portaled straight to <body>
  // (like the filter bar's dropdown, z-50) render on top of it regardless.
  // Portal calls need `document`, so this only runs once mounted client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed top-0 right-0 left-0 bottom-0 flex justify-center items-center text-white transition-all duration-300 z-800 w-full h-full backdrop-blur-[10px] gap-2 px-4 ${selected ? "opacity-100 visible" : "opacity-0 invisible"}`}
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
        if (e.key === "Escape") {
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
    </div>,
    document.body
  );
}

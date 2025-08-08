import React from "react";

export default function AbsoluteModal({
  children,
  selected,
  setSelected,
  maxWidth,
  maxHeight,
  height,
}: {
  children: React.ReactNode;
  selected: any;
  setSelected: (selected: any) => void;
  maxWidth?: string;
  maxHeight?: string;
  height?: string;
}) {
  return (
    <div
      className={`fixed top-0 right-0 left-0 bottom-0 flex justify-center items-center text-white transition-all duration-300 z-50 w-full h-full backdrop-blur-[10px] gap-2 ${selected !== null ? "opacity-100 visible" : "opacity-0 invisible"}`}
      onClick={(e) => {
        // Only close if clicking the background, not the content
        if (e.target === e.currentTarget) {
          setSelected(null);
        }
      }}
    >
      <div 
        className="flex flex-col items-center justify-center bg-white dark:bg-gray-700 rounded-lg border border-gray-800 overflow-hidden"
        style={{ maxWidth: maxWidth || '100%', maxHeight: maxHeight || '100%', height: '' }}
      >
        {children}
      </div>
    </div>
  );
}

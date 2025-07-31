import React from "react";

export default function AbsoluteModal({
  children,
  selected,
  setSelected,
}: {
  children: React.ReactNode;
  selected: any;
  setSelected: (selected: any) => void;
}) {
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
        <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-700 rounded-lg border border-gray-800 w-full h-full overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

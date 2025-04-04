import { IoClose } from "react-icons/io5";
import React, { useState, MouseEvent, useEffect } from "react";
import { MdDragHandle } from "react-icons/md";

type MapTooltipProps = {
  left: number;
  top: number;
  children: React.ReactNode;
  setHoverInfo: (hoverInfo: any) => void;
  isOpen?: boolean;
  onExitAction?: () => void;
};

export default function MapTooltip({
  left: initialLeft,
  top: initialTop,
  children,
  setHoverInfo,
  isOpen = false,
  onExitAction,
}: MapTooltipProps) {
  const [position, setPosition] = useState({
    left: initialLeft,
    top: initialTop,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [wasOpen, setWasOpen] = useState(isOpen);

  const handleMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.left,
      y: e.clientY - position.top,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newPosition = {
        left: e.clientX - dragOffset.x,
        top: e.clientY - dragOffset.y,
      };
      setPosition(newPosition);

      setHoverInfo((prev: any) => ({
        ...prev,
        x: newPosition.left,
        y: newPosition.top,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove as any);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove as any);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging && !wasOpen) {
      setPosition({
        left: initialLeft,
        top: initialTop,
      });
      setWasOpen(true);
    }
  }, [initialLeft, initialTop, isDragging]);

  if (!children) {
    return null;
  }

  const handleBackdropClick = (e: MouseEvent) => {
    // Only close if clicking outside the tooltip
    if (e.target === e.currentTarget) {
      setHoverInfo(null);
      onExitAction?.();
    }
  };

  return (
    <div
      className="absolute inset-0 z-10"
      onClick={handleBackdropClick}
      style={{ pointerEvents: "none" }}
    >
      <div
        className="absolute bg-white dark:bg-gray-800 border rounded-lg shadow-lg border-gray-200 dark:border-gray-700"
        style={{
          left: position.left,
          top: position.top,
          pointerEvents: "auto",
        }}
      >
        <div className="flex items-center justify-between p-2 text-gray-800 dark:text-gray-100 gap-1">
          <div
            className="cursor-move flex items-center justify-center flex-grow hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
            onMouseDown={handleMouseDown}
          >
            <MdDragHandle size={20} />
          </div>
          <div
            className="cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
            onClick={() => {
              setHoverInfo(null);
              onExitAction?.();
            }}
          >
            <IoClose size={20} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

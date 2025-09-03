import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, GripHorizontal } from 'lucide-react';

type Position = {
  x: number;
  y: number;
};

type FloatingDataDisplayProps = {
  initialPosition: Position;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
};

export default function FloatingDataDisplay({ 
  initialPosition, 
  isOpen,
  children, 
  onClose,
  containerRef,
}: FloatingDataDisplayProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    
    // Calculate offset considering container position
    let containerOffset = { x: 0, y: 0 };
    if (containerRef?.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      containerOffset = {
        x: containerRect.left,
        y: containerRect.top,
      };
    }
    
    dragOffsetRef.current = {
      x: e.clientX - containerOffset.x - position.x,
      y: e.clientY - containerOffset.y - position.y,
    };
  }, [position, containerRef]);

  const getContainerBounds = useCallback(() => {
    if (containerRef?.current) {
      const container = containerRef.current;
      return {
        width: container.clientWidth,
        height: container.clientHeight,
      };
    }
    // Fallback to viewport if no container provided
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }, [containerRef]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    // Calculate container offset if we have a container
    let containerOffset = { x: 0, y: 0 };
    if (containerRef?.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      containerOffset = {
        x: containerRect.left,
        y: containerRect.top,
      };
    }
    
    // Calculate new position relative to container
    const newPosition = {
      x: e.clientX - containerOffset.x - dragOffsetRef.current.x,
      y: e.clientY - containerOffset.y - dragOffsetRef.current.y,
    };
    
    // Get actual dialog dimensions for accurate boundary constraints
    const dialogElement = dialogRef.current;
    if (!dialogElement) {
      setPosition(newPosition);
      return;
    }
    
    // Use offsetWidth/offsetHeight for consistent dimensions
    const dialogWidth = dialogElement.offsetWidth;
    const dialogHeight = dialogElement.offsetHeight;
    const containerBounds = getContainerBounds();
    
    // Calculate boundaries ensuring the dialog stays fully within container
    const minX = 0;
    const minY = 0;
    const maxX = Math.max(0, containerBounds.width - dialogWidth);
    const maxY = Math.max(0, containerBounds.height - dialogHeight);
    
    setPosition({
      x: Math.max(minX, Math.min(newPosition.x, maxX)),
      y: Math.max(minY, Math.min(newPosition.y, maxY)),
    });
  }, [isDragging, getContainerBounds, containerRef]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle drag events
  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Initialize position only once when component first mounts and dialog is ready
  useEffect(() => {
    if (initializedRef.current) return;
    
    const constrainPosition = (pos: Position) => {
      const dialogElement = dialogRef.current;
      if (!dialogElement) return pos;
      
      const dialogWidth = dialogElement.offsetWidth;
      const dialogHeight = dialogElement.offsetHeight;
      const containerBounds = getContainerBounds();
      
      const minX = 0;
      const minY = 0;
      const maxX = Math.max(0, containerBounds.width - dialogWidth);
      const maxY = Math.max(0, containerBounds.height - dialogHeight);
      
      return {
        x: Math.max(minX, Math.min(pos.x, maxX)),
        y: Math.max(minY, Math.min(pos.y, maxY)),
      };
    };
    
    // Use setTimeout to ensure the dialog is rendered and has dimensions
    const timer = setTimeout(() => {
      if (dialogRef.current && !initializedRef.current) {
        setPosition(constrainPosition(initialPosition));
        initializedRef.current = true;
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, [initialPosition, getContainerBounds]);

  // Handle window resize to keep dialog within bounds
  useEffect(() => {
    const handleResize = () => {
      const dialogElement = dialogRef.current;
      if (!dialogElement) return;
      
      const dialogWidth = dialogElement.offsetWidth;
      const dialogHeight = dialogElement.offsetHeight;
      const containerBounds = getContainerBounds();
      
      const minX = 0;
      const minY = 0;
      const maxX = Math.max(0, containerBounds.width - dialogWidth);
      const maxY = Math.max(0, containerBounds.height - dialogHeight);
      
      setPosition(prevPosition => ({
        x: Math.max(minX, Math.min(prevPosition.x, maxX)),
        y: Math.max(minY, Math.min(prevPosition.y, maxY)),
      }));
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getContainerBounds]);

  if (!isOpen || !children) {
    return null;
  }

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ pointerEvents: "none" }}
    >
      <div
        ref={dialogRef}
        className={`absolute bg-white dark:bg-slate-800 border rounded-lg shadow-lg border-slate-200 dark:border-slate-700 min-w-64 max-w-md pointer-events-auto`}
        style={{
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-700">
          <div
            className="flex-1 cursor-grab hover:bg-slate-100 dark:hover:bg-slate-700 rounded p-1 flex items-center justify-center"
            onMouseDown={handleMouseDown}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <GripHorizontal className="w-4 h-4 text-slate-500" />
          </div>
          <button
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-3">
          {children}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import type { SelectedSlot } from "../../types/calendar-slot";

interface SlotPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ReassignmentConnectorProps {
  originSlot: SelectedSlot;
  targetSlot: SelectedSlot | null;
  serviceId: string;
}

/**
 * Get the DOM element for a specific slot in the calendar
 */
function getSlotElement(slot: SelectedSlot): HTMLElement | null {
  // Format the slot identifier that matches the data attribute
  const dateStr = dayjs(slot.date).format("YYYY-MM-DD");
  const timeStr = `${slot.hour.toString().padStart(2, "0")}:${slot.minutes.toString().padStart(2, "0")}`;

  // Try to find the slot element using data attributes
  const selector = `[data-slot-date="${dateStr}"][data-slot-time="${timeStr}"]`;
  return document.querySelector(selector);
}

/**
 * Get the center position of an element
 */
function getElementCenter(element: HTMLElement): SlotPosition {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Visual connector that draws a line and arrow between the original slot
 * and the target slot during reassignment
 */
export function ReassignmentConnector({
  originSlot,
  targetSlot,
  serviceId,
}: Readonly<ReassignmentConnectorProps>) {
  const [originPos, setOriginPos] = useState<SlotPosition | null>(null);
  const [targetPos, setTargetPos] = useState<SlotPosition | null>(null);

  const updatePositions = useCallback(() => {
    const originElement = getSlotElement(originSlot);
    if (originElement) {
      setOriginPos(getElementCenter(originElement));
    } else {
      setOriginPos(null);
    }

    if (targetSlot) {
      const targetElement = getSlotElement(targetSlot);
      if (targetElement) {
        setTargetPos(getElementCenter(targetElement));
      } else {
        // Target slot exists but element not found (different day visible)
        setTargetPos(null);
      }
    } else {
      setTargetPos(null);
    }
  }, [originSlot, targetSlot]);

  // Update positions on mount, when slots change, and periodically to detect DOM changes
  useEffect(() => {
    updatePositions();

    // Update on scroll and resize
    const handleUpdate = () => {
      requestAnimationFrame(updatePositions);
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    // Poll for DOM changes (e.g., when user navigates to different day)
    const intervalId = setInterval(updatePositions, 200);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
      clearInterval(intervalId);
    };
  }, [updatePositions]);

  // Don't render if we don't have positions or target
  if (!originPos || !targetPos) return null;

  // Calculate distance and check orientation
  const dx = targetPos.x - originPos.x;
  const dy = targetPos.y - originPos.y;
  const isHorizontal = Math.abs(dy) < 30; // Same row (same time)
  const isVertical = Math.abs(dx) < 30; // Same column (same day)
  const length = Math.hypot(dx, dy);

  // For horizontal lines, curve above/below; for vertical lines, curve left/right
  const horizontalCurveOffset = isHorizontal ? Math.min(60, length * 0.3) : 0;
  const verticalCurveOffset = isVertical ? Math.min(60, length * 0.3) : 0;

  // Arc direction for horizontal: up if moving right, down if moving left
  const horizontalArcDirection = dx > 0 ? -1 : 1;
  // Arc direction for vertical: right if moving down, left if moving up
  const verticalArcDirection = dy > 0 ? 1 : -1;

  // Calculate end point and arrow angle
  let endX: number;
  let endY: number;
  let angle: number;
  let controlX: number;
  let controlY: number;
  let useCurve = false;

  if (isHorizontal && Math.abs(dx) > 30) {
    // Horizontal movement - curve vertically
    useCurve = true;
    controlX = (originPos.x + targetPos.x) / 2;
    controlY = originPos.y + horizontalCurveOffset * horizontalArcDirection;
    const tangentX = targetPos.x - controlX;
    const tangentY = targetPos.y - controlY;
    angle = Math.atan2(tangentY, tangentX);
    endX = targetPos.x - Math.cos(angle) * 20;
    endY = targetPos.y - Math.sin(angle) * 20;
  } else if (isVertical && Math.abs(dy) > 30) {
    // Vertical movement (same day) - curve horizontally
    useCurve = true;
    controlX = originPos.x + verticalCurveOffset * verticalArcDirection;
    controlY = (originPos.y + targetPos.y) / 2;
    const tangentX = targetPos.x - controlX;
    const tangentY = targetPos.y - controlY;
    angle = Math.atan2(tangentY, tangentX);
    endX = targetPos.x - Math.cos(angle) * 20;
    endY = targetPos.y - Math.sin(angle) * 20;
  } else {
    // Diagonal movement - straight line
    angle = Math.atan2(dy, dx);
    endX = targetPos.x - Math.cos(angle) * 20;
    endY = targetPos.y - Math.sin(angle) * 20;
    controlX = (originPos.x + endX) / 2;
    controlY = (originPos.y + endY) / 2;
  }

  // Arrow head size
  const arrowSize = 10;
  const arrowAngle = Math.PI / 6; // 30 degrees

  // Arrow head points
  const arrowX1 = endX - arrowSize * Math.cos(angle - arrowAngle);
  const arrowY1 = endY - arrowSize * Math.sin(angle - arrowAngle);
  const arrowX2 = endX - arrowSize * Math.cos(angle + arrowAngle);
  const arrowY2 = endY - arrowSize * Math.sin(angle + arrowAngle);

  // Create path - curved for horizontal/vertical, straight for diagonal
  const pathD = useCurve
    ? `M ${originPos.x} ${originPos.y} Q ${controlX} ${controlY} ${endX} ${endY}`
    : `M ${originPos.x} ${originPos.y} L ${endX} ${endY}`;

  return createPortal(
    <svg
      className="fixed inset-0 pointer-events-none z-[9998]"
      style={{ width: "100vw", height: "100vh" }}
    >
      <defs>
        {/* Gradient for the line */}
        <linearGradient
          id={`connector-gradient-${serviceId}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
        </linearGradient>

        {/* Glow filter */}
        <filter
          id={`connector-glow-${serviceId}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Path from origin to target - curved for horizontal, straight otherwise */}
      <path
        d={pathD}
        stroke="#f59e0b"
        strokeWidth="2"
        strokeDasharray="6 4"
        fill="none"
        filter={`url(#connector-glow-${serviceId})`}
        className="animate-pulse"
      />

      {/* Arrow head */}
      <polygon
        points={`${endX},${endY} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`}
        fill="#f59e0b"
        filter={`url(#connector-glow-${serviceId})`}
      />

      {/* Origin marker (circle) */}
      <circle
        cx={originPos.x}
        cy={originPos.y}
        r="6"
        fill="#f59e0b"
        stroke="white"
        strokeWidth="2"
        filter={`url(#connector-glow-${serviceId})`}
      />

      {/* Target marker (pulsing circle) */}
      <circle
        cx={targetPos.x}
        cy={targetPos.y}
        r="8"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        className="animate-ping"
        style={{ transformOrigin: `${targetPos.x}px ${targetPos.y}px` }}
      />
      <circle
        cx={targetPos.x}
        cy={targetPos.y}
        r="6"
        fill="#f59e0b"
        stroke="white"
        strokeWidth="2"
      />
    </svg>,
    document.body
  );
}

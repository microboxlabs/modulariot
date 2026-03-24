"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import type { SpecialView } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import SpecialViewCard from "./special-view-card";

const VISIBLE_ITEMS = 3;
const AUTO_ADVANCE_INTERVAL_MS = 5000;

interface SpecialViewsCarouselProps {
  readonly views: SpecialView[];
  readonly dict: I18nRecord;
}

export default function SpecialViewsCarousel({
  views,
  dict,
}: SpecialViewsCarouselProps) {
  const totalItems = views.length;
  const visibleCount = Math.min(VISIBLE_ITEMS, totalItems);
  const showNavigation = totalItems > visibleCount;
  const maxIndex = Math.max(0, totalItems - visibleCount);

  // Pre-compute CSS values for carousel sizing
  const gapRem = 0.75; // gap-3 = 0.75rem
  const totalGapRem = (visibleCount - 1) * gapRem;
  const itemWidth = `calc((100% - ${totalGapRem}rem) / ${visibleCount})`;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const safeIndex = Math.min(currentIndex, maxIndex);

  const clearAutoAdvance = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const goToPrevious = useCallback(() => {
    clearAutoAdvance();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
  }, [maxIndex, clearAutoAdvance]);

  const goToNext = useCallback(() => {
    clearAutoAdvance();
    setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
  }, [maxIndex, clearAutoAdvance]);

  const goToSlide = useCallback(
    (index: number) => {
      clearAutoAdvance();
      setCurrentIndex(index);
    },
    [clearAutoAdvance]
  );

  const handleFocus = useCallback(() => setIsPaused(true), []);
  const handleBlur = useCallback(() => setIsPaused(false), []);
  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);

  // Auto-advance with setTimeout keyed on currentIndex
  useEffect(() => {
    if (!showNavigation || isPaused) {
      clearAutoAdvance();
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    }, AUTO_ADVANCE_INTERVAL_MS);

    return clearAutoAdvance;
  }, [showNavigation, isPaused, maxIndex, currentIndex, clearAutoAdvance]);

  if (totalItems === 0) {
    return null;
  }

  return (
    <div
      role="presentation"
      className="flex flex-col gap-2"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {tr("specialViews.title", dict)}
      </h2>
      <div className="relative flex items-center">
        {showNavigation && (
          <button
            type="button"
            onClick={goToPrevious}
            className="shrink-0 p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label={tr("specialViews.previous", dict)}
          >
            <HiChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}
        <div className="flex-1 overflow-hidden px-2">
          <div
            className="flex gap-3 transition-transform duration-300 ease-in-out"
            style={{
              transform: `translateX(calc(-${safeIndex} * (100% - ${totalGapRem}rem) / ${visibleCount} - ${safeIndex * gapRem}rem))`,
            }}
          >
            {views.map((view) => (
              <div
                key={view.id}
                className="shrink-0"
                style={{
                  width: itemWidth,
                }}
              >
                <SpecialViewCard view={view} dict={dict} />
              </div>
            ))}
          </div>
        </div>
        {showNavigation && (
          <button
            type="button"
            onClick={goToNext}
            className="shrink-0 p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label={tr("specialViews.next", dict)}
          >
            <HiChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}
      </div>
      {showNavigation && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: maxIndex + 1 }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
              className="relative w-3 h-3 flex items-center justify-center"
              aria-label={tr("specialViews.goToSlide", dict, {
                number: String(index + 1),
              })}
            >
              <span
                className={`absolute w-2 h-2 rounded-full transition-colors ${
                  index === safeIndex
                    ? "bg-blue-600 dark:bg-blue-400"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
              {index === safeIndex && !isPaused && (
                <svg
                  key={`progress-${safeIndex}`}
                  className="absolute w-3 h-3 -rotate-90"
                  viewBox="0 0 12 12"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-blue-600/30 dark:text-blue-400/30"
                  />
                  <circle
                    cx="6"
                    cy="6"
                    r="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray={2 * Math.PI * 5}
                    strokeDashoffset={2 * Math.PI * 5}
                    className="text-blue-600 dark:text-blue-400 animate-carousel-progress"
                    style={{
                      animationDuration: `${AUTO_ADVANCE_INTERVAL_MS}ms`,
                    }}
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

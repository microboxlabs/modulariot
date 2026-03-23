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
  const showNavigation = totalItems > VISIBLE_ITEMS;
  const maxIndex = Math.max(0, totalItems - VISIBLE_ITEMS);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const safeIndex = Math.min(currentIndex, maxIndex);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
  }, [maxIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
  }, [maxIndex]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // Auto-advance
  useEffect(() => {
    if (!showNavigation || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    }, AUTO_ADVANCE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [showNavigation, isPaused, maxIndex]);

  if (totalItems === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {tr("specialViews.title", dict)}
      </h2>
      <div className="relative flex items-center gap-2">
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
        <div className="flex-1 overflow-hidden">
          <div
            className="flex gap-3 transition-transform duration-300 ease-in-out"
            style={{
              transform: `translateX(calc(-${safeIndex} * ((100% - ${(VISIBLE_ITEMS - 1) * 0.75}rem) / ${VISIBLE_ITEMS} + 0.75rem)))`,
            }}
          >
            {views.map((view) => (
              <div
                key={view.id}
                className="shrink-0"
                style={{
                  width: `calc((100% - ${(VISIBLE_ITEMS - 1) * 0.75}rem) / ${VISIBLE_ITEMS})`,
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

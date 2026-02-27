"use client";

import { useState, useCallback, useMemo } from "react";
import type { SpecialView } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import SpecialViewCard from "./special-view-card";

const CARDS_PER_PAGE = 3;

interface SpecialViewsCarouselProps {
  readonly views: SpecialView[];
  readonly dict: I18nRecord;
}

export default function SpecialViewsCarousel({
  views,
  dict,
}: SpecialViewsCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const pages = useMemo(() => {
    const result: SpecialView[][] = [];
    for (let i = 0; i < views.length; i += CARDS_PER_PAGE) {
      result.push(views.slice(i, i + CARDS_PER_PAGE));
    }
    return result;
  }, [views]);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {tr("specialViews.title", dict)}
      </h2>
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{
            width: `${pages.length * 100}%`,
            transform: `translateX(-${(activeIndex * 100) / pages.length}%)`,
          }}
        >
          {pages.map((page, pageIndex) => (
            <div
              key={`page-${pageIndex}`}
              style={{ width: `${100 / pages.length}%` }}
              className="grid grid-cols-1 md:grid-cols-3 gap-3 px-0.5"
            >
              {page.map((view) => (
                <SpecialViewCard key={view.id} view={view} dict={dict} />
              ))}
            </div>
          ))}
        </div>
      </div>
      {pages.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {pages.map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === activeIndex
                  ? "bg-blue-600 dark:bg-blue-400"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

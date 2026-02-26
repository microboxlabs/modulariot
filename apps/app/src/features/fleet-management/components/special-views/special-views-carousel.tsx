"use client";

import { useState, useCallback } from "react";
import type { SpecialView } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import SpecialViewCard from "./special-view-card";

interface SpecialViewsCarouselProps {
  readonly views: SpecialView[];
  readonly dict: I18nRecord;
}

export default function SpecialViewsCarousel({
  views,
  dict,
}: SpecialViewsCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {tr("specialViews.title", dict)}
      </h2>
      <div className="relative overflow-hidden rounded-xl">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {views.map((view) => (
            <div key={view.id} className="w-full flex-shrink-0 px-0.5">
              <SpecialViewCard view={view} dict={dict} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-1.5">
        {views.map((view, index) => (
          <button
            key={view.id}
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
    </div>
  );
}

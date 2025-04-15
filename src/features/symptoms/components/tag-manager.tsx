"use client";

import { Tooltip } from "flowbite-react";
import React, { useEffect, useRef, useState } from "react";

type Tag = {
  text: string | React.ReactNode;
  icon?: React.ReactNode;
};

export default function TagManager({
  tags,
  tag_style,
}: {
  tags: Tag[];
  tag_style: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleTags, setVisibleTags] = useState<Tag[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);

  useEffect(() => {
    const calculateVisibleTags = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.offsetWidth;
      let currentWidth = 0;
      const tempDiv = document.createElement("div");
      tempDiv.style.cssText = `
        visibility: hidden;
        position: absolute;
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
        white-space: nowrap;
      `;
      document.body.appendChild(tempDiv);

      const visible: Tag[] = [];
      let hidden = 0;

      tempDiv.textContent = "+99";
      const plusTagWidth = tempDiv.offsetWidth + 16;

      let totalGapWidth = 0;

      for (const tag of tags) {
        tempDiv.textContent =
          typeof tag.text === "string" ? tag.text : "placeholder";
        const tagWidth = tempDiv.offsetWidth + 16;
        const withGap = tagWidth + 15;
        totalGapWidth = visible.length * 15;

        if (
          currentWidth + withGap + totalGapWidth <=
          containerWidth - (hidden > 0 ? plusTagWidth + 15 : 0)
        ) {
          visible.push(tag);
          currentWidth += tagWidth;
        } else {
          hidden++;
        }
      }

      document.body.removeChild(tempDiv);
      setVisibleTags(visible);
      setHiddenCount(hidden);
    };

    requestAnimationFrame(() => {
      calculateVisibleTags();
    });

    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleTags();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [tags]);

  return (
    <div ref={containerRef} className="flex flex-row flex-wrap w-full gap-2">
      {visibleTags.map(
        (tag, index) =>
          tag.text && (
            <div
              key={index}
              className={`shrink-0 inline-flex items-center gap-2 ${tag_style} border-2 rounded-lg px-1 py-0.5 text-sm gap-1`}
            >
              {tag.icon}
              <span className="whitespace-nowrap">
                {typeof tag.text === "string" ? tag.text : tag.text}
              </span>
            </div>
          ),
      )}
      {hiddenCount > 0 && (
        <Tooltip
          theme={{
            arrow: {
              base: "absolute z-10 h-2 w-2 rotate-45 border-b border-r border-gray-400 dark:border-gray-600",
              style: {
                auto: "bg-gray-100 dark:bg-gray-800",
              },
            },
            base: "absolute z-10 inline-block rounded-lg px-3 py-2 text-sm font-medium shadow-sm border border-gray-400 dark:border-gray-600",
            style: {
              auto: "bg-gray-100 dark:bg-gray-800",
            },
          }}
          style="auto"
          content={
            <div className="flex flex-col gap-1">
              {tags.slice(visibleTags.length).map(
                (tag, index) =>
                  tag.text && (
                    <div
                      key={index}
                      className="flex items-center gap-2 whitespace-nowrap border-2 border-gray-300 dark:border-gray-600 rounded-lg px-2 py-0.5 text-sm font-light !bg-gray-100 text-gray-900 dark:!bg-gray-800 dark:text-white"
                    >
                      {tag.icon}
                      <span className="font-light">
                        {typeof tag.text === "string" ? tag.text : tag.text}
                      </span>
                    </div>
                  ),
              )}
            </div>
          }
        >
          <div
            className={`shrink-0 inline-flex items-center gap-2 ${tag_style} border-2 rounded-lg px-1 py-0.5 text-sm gap-1 cursor-pointer relative`}
          >
            +{hiddenCount}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

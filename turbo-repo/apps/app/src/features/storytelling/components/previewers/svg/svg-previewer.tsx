"use client";

import { useEffect, useMemo } from "react";

interface SvgPreviewerProps {
  readonly svg: string;
  readonly title: string;
  readonly onReadyChange?: (ready: boolean) => void;
}

/**
 * Shows the SVG as an image. An SVG loaded through `<img>` runs no scripts,
 * fires no event handlers and loads no external resources, so the markup
 * needs no sanitizing of its own.
 */
export function SvgPreviewer({ svg, title, onReadyChange }: SvgPreviewerProps) {
  const src = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg]
  );

  useEffect(() => {
    onReadyChange?.(true);
  }, [onReadyChange]);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimize */}
      <img
        src={src}
        alt={title}
        className="max-h-full max-w-full rounded bg-white shadow-sm"
      />
    </div>
  );
}

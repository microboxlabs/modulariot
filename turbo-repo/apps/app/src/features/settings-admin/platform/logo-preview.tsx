"use client";

import type { ReactNode } from "react";

interface LogoPreviewProps {
  readonly lightLabel: string;
  readonly darkLabel: string;
  /** Rendered once per ground; the same node description, drawn twice. */
  readonly children: ReactNode;
}

/**
 * One logo shown on both grounds it has to survive, each captioned.
 *
 * A domain gets a single logo but the sign-in navbar has a light and a dark
 * theme, so the only way to judge an upload is to see it against both. The
 * captions matter as much as the swatches: two unlabelled copies of the same
 * image leave the reader guessing which is which.
 *
 * Each half pins the brand palette to its own ground rather than inheriting
 * the page's, so a mark drawn from the brand CSS variables — the bundled
 * default is one — reads correctly on both. Inheriting instead would make one
 * swatch near-invisible: light ink on white in dark mode, and the reverse in
 * light mode.
 */
export default function LogoPreview({
  lightLabel,
  darkLabel,
  children,
}: LogoPreviewProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <figure className="m-0">
        <div className="brand-ground-light flex h-16 items-center justify-center rounded bg-white p-2">
          {children}
        </div>
        <figcaption className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
          {lightLabel}
        </figcaption>
      </figure>
      <figure className="m-0">
        <div className="brand-ground-dark flex h-16 items-center justify-center rounded bg-gray-900 p-2">
          {children}
        </div>
        <figcaption className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
          {darkLabel}
        </figcaption>
      </figure>
    </div>
  );
}

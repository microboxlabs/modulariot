"use client";

import type { ReactNode } from "react";

interface LogoPreviewProps {
  readonly lightLabel: string;
  readonly darkLabel: string;
  readonly light: ReactNode;
  /**
   * Defaults to {@link light}: a domain with one logo shows it on both grounds,
   * which is exactly the case this preview exists to let someone judge.
   */
  readonly dark?: ReactNode;
}

/**
 * What each ground will actually show, captioned.
 *
 * The sign-in navbar has a light and a dark theme, so the only way to judge an
 * upload is to see it against both. A domain that ships one logo sees it twice
 * — which is the point, since that is what visitors get. The captions matter as
 * much as the swatches: two unlabelled images leave the reader guessing which
 * ground is which.
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
  light,
  dark,
}: LogoPreviewProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <figure className="m-0">
        <div className="brand-ground-light flex h-16 items-center justify-center rounded bg-white p-2">
          {light}
        </div>
        <figcaption className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
          {lightLabel}
        </figcaption>
      </figure>
      <figure className="m-0">
        <div className="brand-ground-dark flex h-16 items-center justify-center rounded bg-gray-900 p-2">
          {dark ?? light}
        </div>
        <figcaption className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
          {darkLabel}
        </figcaption>
      </figure>
    </div>
  );
}

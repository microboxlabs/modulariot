"use client";

import { useState, type ComponentType, type SVGProps } from "react";

/**
 * Logo sources for a brand. Any image URL works — SVG, PNG, local asset or remote —
 * because logos render through a plain <img>.
 *
 * Provide `light`/`dark` when the mark needs different ink per theme, or just
 * `default` when one asset reads correctly on both (most brand marks do).
 * Missing entries fall back: theme-specific → default → the built-in key mark.
 */
export interface BrandLogoSources {
  /** Used when the app is in light theme. */
  readonly light?: string;
  /** Used when the app is in dark theme. */
  readonly dark?: string;
  /** Theme-agnostic asset, and the fallback for whichever theme is missing. */
  readonly default?: string;
}

/**
 * Keylines, as in Material's icon grid and the iOS icon template: every mark sits in the
 * same tile, and a round mark is drawn larger than a square one so both read the same size.
 */
export type LogoKeyline = "circle" | "square";

/** The share of the tile a mark fills. Library icons carry their own inner margin, so the round one fills more. */
export const KEYLINE_FILL: Readonly<Record<LogoKeyline, number>> = {
  circle: 0.84,
  square: 0.64,
};

/** Neutral key mark (PNG) used when no logo or icon is given. */
export const DEFAULT_BRAND_LOGO: BrandLogoSources = {
  default: "/credential-logos/credential-default.png",
};

/**
 * Collapses a logo to the two sources the renderer needs. When both come out
 * equal the caller can render a single <img> instead of a light/dark pair.
 */
export function resolveBrandLogo(logo?: BrandLogoSources): {
  lightSrc: string;
  darkSrc: string;
} {
  const fallback =
    logo?.default ??
    DEFAULT_BRAND_LOGO.default ??
    DEFAULT_BRAND_LOGO.light ??
    "";
  return {
    lightSrc: logo?.light ?? fallback,
    darkSrc: logo?.dark ?? fallback,
  };
}

/**
 * A raw <img> does not get the app's basePath the way next/image and next/link
 * do, so app-relative logo paths have to be prefixed by hand. Absolute and data
 * URLs (a tenant-hosted brand asset, say) are left alone.
 */
function withBasePath(src: string): string {
  if (!src || src.startsWith("data:") || /^([a-z]+:)?\/\//i.test(src)) {
    return src;
  }
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${src}`;
}

interface BrandLogoProps {
  readonly logo?: BrandLogoSources;
  /** A library icon; drawn in gray instead of the logo image. */
  readonly icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** The mark's shape; a round mark fills more of the tile. */
  readonly keyline?: LogoKeyline;
  /** Accessible name — pass the translated type name. */
  readonly alt: string;
  /** Rendered box in pixels (square). */
  readonly size?: number;
  readonly className?: string;
}

/**
 * Renders the logo of a credential or connection type, honouring the app's light/dark theme.
 *
 * Theme switching is CSS-only (`dark:hidden` / `hidden dark:block`, matching the
 * navbar logo idiom) so there is no flash and no hydration mismatch. A plain
 * <img> keeps the source format-agnostic: SVG, PNG, local or remote all work.
 * A source that fails to load falls back to the built-in key mark rather than
 * leaving a broken image in the row.
 */
export function BrandLogo({
  keyline = "square",
  size = 24,
  className = "",
  ...mark
}: BrandLogoProps) {
  const glyph = Math.round(size * KEYLINE_FILL[keyline]);
  return (
    <span
      data-keyline={keyline}
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
    >
      <LogoMark {...mark} size={glyph} />
    </span>
  );
}

/** The mark itself, sized to the tile's keyline. */
function LogoMark({
  logo,
  icon: Icon,
  alt,
  size = 24,
}: Omit<BrandLogoProps, "keyline" | "className">) {
  const [failed, setFailed] = useState(false);
  if (Icon) {
    return (
      <Icon
        role="img"
        aria-label={alt}
        width={size}
        height={size}
        className="shrink-0 text-gray-600 dark:text-gray-400"
      />
    );
  }
  const resolved = resolveBrandLogo(failed ? DEFAULT_BRAND_LOGO : logo);
  const lightSrc = withBasePath(resolved.lightSrc);
  const darkSrc = withBasePath(resolved.darkSrc);

  const box = "object-contain shrink-0";
  const dimensions = { width: size, height: size };

  // One asset covers both themes — render a single image.
  if (lightSrc === darkSrc) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={lightSrc}
        alt={alt}
        {...dimensions}
        className={box}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lightSrc}
        alt={alt}
        {...dimensions}
        className={`block dark:hidden ${box}`}
        onError={() => setFailed(true)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={darkSrc}
        alt=""
        aria-hidden="true"
        {...dimensions}
        className={`hidden dark:block ${box}`}
        onError={() => setFailed(true)}
      />
    </>
  );
}

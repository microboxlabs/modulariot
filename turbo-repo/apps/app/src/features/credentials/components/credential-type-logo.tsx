"use client";

import { useState } from "react";
import {
  DEFAULT_CREDENTIAL_LOGO,
  resolveCredentialLogo,
  type CredentialLogo,
} from "../credential.types";

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

interface CredentialTypeLogoProps {
  readonly logo?: CredentialLogo;
  /** Accessible name — pass the translated credential type name. */
  readonly alt: string;
  /** Rendered box in pixels (square). */
  readonly size?: number;
  readonly className?: string;
}

/**
 * Renders a credential type's logo, honouring the app's light/dark theme.
 *
 * Theme switching is CSS-only (`dark:hidden` / `hidden dark:block`, matching the
 * navbar logo idiom) so there is no flash and no hydration mismatch. A plain
 * <img> keeps the source format-agnostic: SVG, PNG, local or remote all work.
 * A source that fails to load falls back to the built-in key mark rather than
 * leaving a broken image in the row.
 */
export function CredentialTypeLogo({
  logo,
  alt,
  size = 24,
  className = "",
}: CredentialTypeLogoProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveCredentialLogo(
    failed ? DEFAULT_CREDENTIAL_LOGO : logo
  );
  const lightSrc = withBasePath(resolved.lightSrc);
  const darkSrc = withBasePath(resolved.darkSrc);

  const box = `object-contain shrink-0 ${className}`;
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

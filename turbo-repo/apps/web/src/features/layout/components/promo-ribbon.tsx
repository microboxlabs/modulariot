import Link from "next/link";

/**
 * Promo ribbon — dark bar above the header, per design system.
 *
 * Pure RSC. No dismiss state — design treats the ribbon as a globally-scoped
 * announcement controlled by deploy config, not per-user preference. If product
 * later wants user-side dismiss, re-introduce a small client wrapper.
 */
type PromoRibbonProps = {
  tag?: string;
  message?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export function PromoRibbon({
  tag = "v0.9 Alpha",
  message = "Modular IoT joins the CNCF Sandbox track",
  ctaLabel = "Read the announcement",
  ctaHref = "#community",
}: PromoRibbonProps) {
  return (
    <div
      role="region"
      aria-label="Site announcement"
      className="flex items-center justify-center gap-2.5 bg-ink-1 px-4 py-2.5 text-center text-[13px] tracking-[-0.005em] text-surface-1 dark:bg-blue-600"
    >
      <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-px text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white">
        {tag}
      </span>
      <span>{message}</span>
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1 underline decoration-from-font underline-offset-[3px] opacity-90 transition-opacity hover:opacity-100"
      >
        {ctaLabel}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
          aria-hidden
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

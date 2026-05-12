"use client";

import { twMerge } from "tailwind-merge";
import { useServiceCategoryName } from "@/features/common/providers/client-api.provider";
import { serviceCategoryInitials } from "@/features/common/utils/service-category";

type ServiceCategoryBadgeVariant = "soft" | "solid" | "ghost";

const VARIANT_CLASSES: Record<ServiceCategoryBadgeVariant, string> = {
  // Soft tinted pill — default, sits well on neutral card backgrounds.
  soft: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  // Solid badge with a contrasting outline — for floating corner badges.
  solid: "bg-indigo-500 text-white border border-white dark:border-gray-900",
  // Borderless, inherits the surrounding text color — for tight inline rows.
  ghost: "border border-current/30 text-current",
};

interface ServiceCategoryBadgeProps {
  /** Service-type code stored on the task/booking (e.g. "ST001"). */
  readonly code: string | null | undefined;
  /** Visual style. Defaults to `soft`. */
  readonly variant?: ServiceCategoryBadgeVariant;
  /** Extra classes, merged after the variant styling. */
  readonly className?: string;
  /**
   * Optional label prefixed to the hover tooltip, e.g. "Categoría de servicio"
   * → tooltip becomes "Categoría de servicio: Servicio Programado".
   */
  readonly tooltipLabel?: string;
}

/**
 * Compact badge showing the Spanish initials of a planned service's category.
 *
 * Renders `null` when the code is missing or cannot be resolved to a name, so
 * callers can fall back to another indicator (e.g. the kanban "F" badge).
 */
export function ServiceCategoryBadge({
  code,
  variant = "soft",
  className,
  tooltipLabel,
}: ServiceCategoryBadgeProps) {
  const { name } = useServiceCategoryName(code);
  if (!name) return null;
  const initials = serviceCategoryInitials(name);
  if (!initials) return null;
  return (
    <span
      title={tooltipLabel ? `${tooltipLabel}: ${name}` : name}
      className={twMerge(
        "inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {initials}
    </span>
  );
}

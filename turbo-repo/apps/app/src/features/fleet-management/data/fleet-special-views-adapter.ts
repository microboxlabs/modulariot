import type { PgrestFleetSpecialViewRow } from "@/app/api/utils/pgrest-client";
import type { SpecialView } from "../types/fleet.types";
import { resolveFleetViewIcon } from "./fleet-special-views-icons";

export type SpecialViewLocale = "es" | "en";

/**
 * Pick the value for the active locale, falling back to the other locale's
 * value if the requested one is null/blank. Returns the empty string only
 * when *both* are missing.
 */
function pickLocalized(
  esValue: string | null | undefined,
  enValue: string | null | undefined,
  locale: SpecialViewLocale
): string {
  const primary = locale === "es" ? esValue : enValue;
  const secondary = locale === "es" ? enValue : esValue;
  if (primary && primary.trim() !== "") return primary;
  if (secondary && secondary.trim() !== "") return secondary;
  return "";
}

/**
 * Map a row from `ams.fleet_special_views` (via pgrest) into the frontend
 * `SpecialView` shape used by the carousel. Resolves the icon string against
 * the allowlist registry and picks the right localized columns.
 */
export function pgrestRowToSpecialView(
  row: PgrestFleetSpecialViewRow,
  locale: SpecialViewLocale
): SpecialView {
  const badgeText = pickLocalized(row.badge_text_es, row.badge_text_en, locale);

  return {
    id: String(row.id),
    title: pickLocalized(row.title_es, row.title_en, locale),
    description: pickLocalized(
      row.description_es,
      row.description_en,
      locale
    ),
    icon: resolveFleetViewIcon(row.icon),
    iconColor: row.icon_color,
    iconDarkColor: row.icon_color_dark,
    badgeText: badgeText !== "" ? badgeText : undefined,
    badgeColor: row.badge_color ?? undefined,
    badgeColorDark: row.badge_color_dark ?? undefined,
    route: row.route,
  };
}

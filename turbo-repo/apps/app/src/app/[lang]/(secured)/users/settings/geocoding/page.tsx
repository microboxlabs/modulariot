import "server-only";
import { redirect } from "next/navigation";
import type { ParamsWithLang } from "@/features/i18n/i18n.service.types";

/** Geocoding moved under Settings › Viajes. */
export default async function GeocodingSettingsPage({
  params,
}: ParamsWithLang) {
  const { lang } = await params;
  redirect(`/${lang}/users/settings/trips?section=geocodingReview`);
}

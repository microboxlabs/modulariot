import "server-only";
import { redirect } from "next/navigation";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";

export default async function SettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  redirect(`/${lang}/users/settings/organizations`);
}

import "server-only";
import { redirect } from "next/navigation";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { currentPermissions } from "@/features/auth/access/server-access";
import { firstAllowedPage } from "@/features/auth/access/landing";
import { homePath } from "@/features/common/providers/alfresco-api/ecm-config";

/** Where `/app` and sign-in land: the first module page the caller may open, or the no-access page. */
export default async function StartPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const page = firstAllowedPage(
    await currentPermissions(),
    homePath(),
    process.env.BOARD_MODULE,
    process.env.DASHBOARD_MODULE
  );
  redirect(`/${lang}${page ?? "/no-access"}`);
}

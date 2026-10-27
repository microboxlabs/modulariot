import "server-only";
import Link from "next/link";
import { Card } from "flowbite-react";
import { auth } from "@/auth";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { currentPermissions } from "@/features/auth/access/server-access";
import { firstAllowedPage } from "@/features/auth/access/landing";
import { homePath } from "@/features/common/providers/alfresco-api/ecm-config";
import HomeAltIcon from "@/features/icons/home-alt";

/**
 * Shown instead of a page the caller may not open. Not gated, so it never redirects. With no module at all, it says
 * the account has no access yet; otherwise it offers the way back.
 */
export default async function NoAccessPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [dict] = await getDictionary(lang);
  const session = await auth();
  const home = firstAllowedPage(
    await currentPermissions(),
    homePath(),
    process.env.BOARD_MODULE,
    process.env.DASHBOARD_MODULE
  );
  const title = home
    ? dict("pages.noAccess.page.title")
    : dict("pages.noAccess.account.title");
  const body = home
    ? dict("pages.noAccess.page.body")
    : dict("pages.noAccess.account.body");

  return (
    <div
      data-testid="no-access"
      className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h1>
      <p className="max-w-xl text-gray-600 dark:text-gray-300">{body}</p>
      {session?.user?.email && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {dict("pages.noAccess.signedInAs")} {session.user.email}
        </p>
      )}
      {home && (
        <Link href={`/${lang}${home}`}>
          <Card className="w-80">
            <div className="flex flex-row items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <HomeAltIcon />
              </div>
              <p className="dark:text-white">{dict("pages.noAccess.back")}</p>
            </div>
          </Card>
        </Link>
      )}
    </div>
  );
}

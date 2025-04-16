import NavbarSignIn from "@/features/auth/components/navbar-sign-in";
import { getDictionary } from "@/features/i18n/i18n.service";
import ReleaseNotes from "@/features/layout/components/release-view/release-notes";
import OtherVersions from "@/features/layout/components/release-view/other-versions";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
export default async function Page({
  params,
}: {
  params: { lang: string; version: string };
}) {
  const [, dict] = await getDictionary(params.lang);
  const version = params.version;

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <NavbarSignIn />
      <div className="flex w-1/3 min-w-[400px] flex-col gap-4 pb-5 px-5 text-gray-900 dark:text-gray-100">
        <ReleaseNotes version={version} />
        <div className="border-t border-gray-200 dark:border-gray-800 mt-5 pt-2 flex flex-col gap-2 w-full justify-center items-center">
          <h2 className="text-lg text-gray-700 dark:text-gray-300">
            {(dict.release as I18nRecord).other_versions as string}
          </h2>
          <OtherVersions version={version} />
        </div>
      </div>
    </div>
  );
}

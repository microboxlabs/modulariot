import Totem from "@/features/totem/totem";
import { getDictionary } from "@/features/i18n/i18n.service";
import { defaultLocale } from "@/features/i18n/tr.service";
import { Footer, FooterCopyright } from "flowbite-react";
import ReleaseView from "@/features/layout/components/release-view/release-view";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import NavbarSignIn from "@/features/auth/components/navbar-sign-in";

export default async function TotemPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const [_dict, dictionary] = await getDictionary(lang ?? defaultLocale);

  return (
    <div className="flex flex-col items-center justify-center w-screen h-screen">
      <NavbarSignIn />
      <Totem dict={dictionary} />
      <Footer
        date-testid="secured-footer"
        className="flex-col sm:flex-row z-40 h-auto sm:h-12 px-5 fixed left-0 bottom-0"
        theme={{
          root: {
            base: "w-full bg-white dark:bg-gray-800 fixed bottom-0 shadow flex items-center justify-between",
          },
        }}
      >
        <FooterCopyright
          className="flex justify-center items-center lg:justify-start whitespace-nowrap text-sm sm:text-base"
          href="https://microboxlabs.com"
          by={(dictionary.footer as I18nRecord).rights as string}
          year={2024}
        />
        <ReleaseView className="flex justify-center items-center lg:justify-end sm:mt-0" />
      </Footer>
    </div>
  );
}

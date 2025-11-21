import "server-only";

import { twMerge } from "tailwind-merge";
import { Inter } from "next/font/google";
import SimpleLayout from "@/features/layout/components/simple-layout";
import notFoundImage from "@assets/images/not-found.png";
import { headers } from "next/headers";
import {
  getDictionary,
  getLocaleFromHeaders,
} from "@/features/i18n/i18n.service";
import Image from "next/image";
import { Card } from "flowbite-react";
import Link from "next/link";
import HomeAltIcon from "@/features/icons/home-alt";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";

const inter = Inter({ subsets: ["latin"] });

export default async function NotFound(params: ParamsWithLang) {
  const lang = getLocaleFromHeaders(await headers());
  const [dict] = await getDictionary(lang);
  return (
    <div
      className={twMerge(
        inter.className,
        "bg-gray-50 dark:bg-gray-900 h-screen flex flex-col"
      )}
    >
      <SimpleLayout params={{ lang }}>
        <div
          data-testid="content"
          className="mt-16 mb-6 flex items-center justify-center flex-col gap-6 h-full"
        >
          <Image
            src={notFoundImage}
            alt="Not Found"
            className="object-cover hidden lg:block"
            width={462}
          />
          <h5 className="text-2xl leading-9 text-blue-600 tracking-tight hidden lg:block">
            {dict("pages.notFound.supportingText")}
          </h5>
          <h5 className="text-2xl leading-9 text-blue-600 tracking-tight lg:hidden">
            {dict("pages.notFound.supportingTextMobile")}
          </h5>
          <h1 className="text-4xl leading-normal dark:text-white hidden lg:block">
            {dict("pages.notFound.heading")}
          </h1>
          <h1 className="text-4xl leading-normal dark:text-white lg:hidden">
            {dict("pages.notFound.supportingText")}
          </h1>
          <Link href={`/${lang}/shipping`}>
            <Card className="w-96">
              <div className="flex justify-center items-center flex-row gap-3">
                <div className="w-12 h-12 text-blue-600 bg-blue-100 rounded-lg flex justify-center items-center">
                  <HomeAltIcon />
                </div>
                <p className="dark:text-white">
                  {dict("pages.notFound.backToHome")}
                </p>
              </div>
            </Card>
          </Link>
        </div>
      </SimpleLayout>
    </div>
  );
}

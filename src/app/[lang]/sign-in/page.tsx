import { Card } from "flowbite-react";
import React from "react";
import { getDictionary } from "@/features/i18n/i18n.service";
import NavbarSignIn from "@/features/auth/components/navbar-sign-in";
import FooterSignIn from "@/features/auth/components/footer-sign-in/footer-sign-in";
import FormSignIn from "@/features/auth/components/form-sign-in/form-sign-in";
import { buildSignInFormMessages } from "@/features/auth/utils/utils";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";

export default async function SignInPage({ params: { lang } }: ParamsWithLang) {
  const [dict] = await getDictionary(lang);
  const signInMessages = buildSignInFormMessages({ messages: dict });

  return (
    <div className="mx-auto flex flex-col px-6 pt-8 md:h-screen">
      <NavbarSignIn />
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full md:max-w-lg">
          <Card
            data-testid="login-card"
            horizontal
            imgAlt=""
            className="bg-white dark:bg-gray-800 transition-colors duration-200"
            theme={{
              root: {
                base: "flex rounded-lg border border-gray-200 shadow-md dark:border-gray-700",
                children: "my-auto w-full gap-0 space-y-8 p-6 sm:p-4 lg:p-8",
              },
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 lg:text-3xl dark:text-white">
              {dict("pages.login.welcome")}
            </h2>
            <FormSignIn messages={signInMessages} />
          </Card>
        </div>
      </div>
      <FooterSignIn messages={dict} />
    </div>
  );
}

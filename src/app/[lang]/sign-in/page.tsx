import { Button, Card, Checkbox, Label, TextInput } from "flowbite-react";
import Link from "next/link";
import type { SignInPageProps } from "./sign-in.types";
import React from "react";
import { getDictionary } from "@/services/i18n/i18n.service";
import NavbarSignIn from "./navbar-sign-in";
import FooterSignIn from "./footer-sign-in";

export default async function SignInPage({
  params: { lang },
}: SignInPageProps) {
  const dict = await getDictionary(lang);

  return (
    <>
      <div className="mx-auto flex flex-col px-6 pt-8 md:h-screen">
        <NavbarSignIn />
        <div className="flex flex-1 flex-col items-center justify-center">
          <Card
            data-testid="login-card"
            horizontal
            imgAlt=""
            className="w-full md:max-w-lg"
            theme={{
              root: {
                children: "my-auto w-full gap-0 space-y-8 p-6 sm:p-4 lg:p-8",
              },
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 lg:text-3xl dark:text-white">
              {dict("pages.login.welcome")}
            </h2>
            <form className="mt-8 space-y-6">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="email">
                  {dict("pages.login.fields.email.label")}
                </Label>
                <TextInput
                  id="email"
                  name="email"
                  placeholder={dict("pages.login.fields.email.placeholder")}
                  type="email"
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="password">
                  {dict("pages.login.fields.password.label")}
                </Label>
                <TextInput
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  type="password"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-3">
                  <Checkbox id="rememberMe" name="rememberMe" />
                  <Label htmlFor="rememberMe">
                    {dict("pages.login.fields.remember.label")}
                  </Label>
                </div>
                <Link
                  href="#"
                  className="text-right text-sm text-primary-700 hover:underline dark:text-primary-500 text-blue-700"
                >
                  {dict("pages.login.fields.forgot.label")}
                </Link>
              </div>
              <div className="mb-6">
                <Button
                  color="blue"
                  type="submit"
                  theme={{ inner: { base: "px-5 py-3" } }}
                  className="w-full px-0 py-px"
                >
                  {dict("pages.login.buttons.submit")}
                </Button>
              </div>
            </form>
          </Card>
        </div>
        <FooterSignIn messages={dict} />
      </div>
    </>
  );
}

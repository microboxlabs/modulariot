"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Card } from "flowbite-react";
import FormSignIn from "@/features/auth/components/form-sign-in/form-sign-in";
import RegisterForm from "@/features/auth/components/form-sign-in/register-form";
import type {
  FormSignInProps,
  RegisterFormMessages,
} from "@/features/auth/components/form-sign-in/form-sign-in.types";

type View = "auth" | "register";

type AuthCardProps = Readonly<{
  signInProps: Omit<FormSignInProps, "onRegisterClick">;
  registerMessages: RegisterFormMessages;
  accessDeniedMessage?: string | null;
}>;

/**
 * Owns the sign-in <-> register toggle as a URL param (?view=register) instead
 * of a separate route, so switching between them is an instant client-side
 * state change rather than a full page navigation.
 */
export default function AuthCard({
  signInProps,
  registerMessages,
  accessDeniedMessage,
}: AuthCardProps) {
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>(() =>
    searchParams.get("view") === "register" ? "register" : "auth"
  );

  // Reflect the view in the URL via the raw History API (no Next.js router
  // navigation, so switching views is instant with no page reload). We read
  // window.location.pathname rather than next/navigation's usePathname()
  // because this app runs behind basePath: "/app", which usePathname()
  // strips — using it here would drop "/app" from the address bar.
  function goToView(next: View) {
    setView(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "register") {
      params.set("view", "register");
    } else {
      params.delete("view");
      params.delete("step");
      params.delete("org");
    }
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`
    );
  }

  if (view === "register") {
    return (
      <div className="mx-auto w-full md:max-w-xl">
        <Card
          data-testid="register-card"
          className="bg-white dark:bg-gray-800 transition-colors duration-200 w-full"
          theme={{
            root: {
              base: "flex overflow-hidden rounded-2xl border border-gray-200 shadow-none dark:border-gray-700",
              children: "w-full flex-col justify-start gap-0 p-0",
            },
          }}
        >
          <RegisterForm
            msg={registerMessages}
            onBackToLogin={() => goToView("auth")}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full md:max-w-lg">
      <Card
        data-testid="login-card"
        horizontal
        imgAlt=""
        className="bg-white dark:bg-gray-800 transition-colors duration-200"
        theme={{
          root: {
            base: "flex rounded-lg border border-gray-200 shadow-md dark:border-gray-700",
            children: "my-auto w-full gap-0 p-6 sm:p-4 lg:p-8",
          },
        }}
      >
        {accessDeniedMessage && (
          <Alert
            color="failure"
            data-testid="sign-in-access-denied"
            className="w-full"
          >
            {accessDeniedMessage}
          </Alert>
        )}
        <FormSignIn {...signInProps} onRegisterClick={() => goToView("register")} />
      </Card>
    </div>
  );
}

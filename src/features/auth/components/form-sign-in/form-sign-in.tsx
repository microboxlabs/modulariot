"use client";

import { authenticateAction } from "@/features/auth/services/auth.service";
import { useFormStatus, useFormState } from "react-dom";
import { Button, Checkbox, Label, TextInput } from "flowbite-react";
import { FormSignInProps } from "./form-sign-in.types";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FormSignIn({ messages: msg }: FormSignInProps) {
  const router = useRouter();
  const [state, formAction] = useFormState(authenticateAction, {});
  const { pending } = useFormStatus();

  useEffect(() => {
    if (state.success) {
      router.replace("/kanban");
    }
  }, [state]);

  useEffect(() => {
    console.log("pending", pending);
  }, [pending]);

  return (
    <form className="mt-8 space-y-6" action={formAction}>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="email">{msg.emailLabel}</Label>
        <TextInput
          id="email"
          name="email"
          placeholder={msg.emailPlaceHolder}
          type="text"
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="password">{msg.passwordLabel}</Label>
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
          <Label htmlFor="rememberMe">{msg.rememberMeLabel}</Label>
        </div>
        <Link
          href="#"
          className="text-right text-sm text-primary-700 hover:underline dark:text-primary-500 text-blue-700"
        >
          {msg.forgotPasswordLabel}
        </Link>
      </div>
      <div className="mb-6">
        <Button
          color="blue"
          type="submit"
          theme={{ inner: { base: "px-5 py-3" } }}
          className="w-full px-0 py-px"
          isProcessing={pending}
          aria-disabled={pending}
        >
          {msg.buttonSubmitLabel}
        </Button>
      </div>
    </form>
  );
}

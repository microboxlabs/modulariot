"use client";

import {
  authenticateAction,
  signInWithMicrosoft,
} from "@/features/auth/services/auth.service";
import { Button, Checkbox, Label, TextInput } from "flowbite-react";
import { FormSignInProps } from "./form-sign-in.types";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formSchema, FormSchema } from "../../services/auth.service.types";
//import { useRouter } from "next/navigation";

export default function FormSignIn({ messages: msg }: FormSignInProps) {
  //const router = useRouter();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const { register } = form;
  const [_state, formAction] = useFormState(authenticateAction, {});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (_state?.success) {
      setPending(false);
    }
  }, [_state]);

  const onSubmitForm = async function (e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setPending(true);
    await e.currentTarget.form?.requestSubmit();
  };

  const getMessages = function (message = "") {
    return message == "Invalid form data"
      ? msg.invalidFromData
      : message == "Invalid credentials"
        ? msg.invalidCredentials
        : message;
  };

  return (
    <form className="mt-8 space-y-6" action={formAction}>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="email">{msg.emailLabel}</Label>
        <TextInput
          id="email"
          /* name="email" */
          placeholder={msg.emailPlaceHolder}
          type="text"
          className={
            _state && _state.dataErrors?.email
              ? "animate-pulse border-2 border-rose-500"
              : ""
          }
          {...register("email")}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="password">{msg.passwordLabel}</Label>
        <TextInput
          id="password"
          /* name="password" */
          placeholder="••••••••"
          type="password"
          className={
            _state && _state.dataErrors?.password
              ? "animate-pulse border-2 border-rose-500"
              : ""
          }
          {...register("password")}
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
      {_state?.message && !_state?.success && (
        <div className="text-red-500 mb-4">{getMessages(_state.message)}</div>
      )}
      {/* <div>
        {_state && _state.dataErrors && JSON.stringify(_state.dataErrors)}
      </div> */}
      <div className="mb-6">
        <Button
          color="blue"
          theme={{ inner: { base: "px-5 py-3" } }}
          className="w-full px-0 py-px submit"
          isProcessing={pending && _state?.success == undefined}
          aria-disabled={pending && _state?.success == undefined}
          onClick={onSubmitForm}
        >
          {msg.buttonSubmitLabel}
        </Button>
      </div>
      <div className="mb-2">
        <Button
          color="gray"
          theme={{ inner: { base: "px-5 py-3" } }}
          className="w-full px-0 py-px"
          type="submit"
          formAction={signInWithMicrosoft}
        >
          Continue with Microsoft
        </Button>
      </div>
    </form>
  );
}

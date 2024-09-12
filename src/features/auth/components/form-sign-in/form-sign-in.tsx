"use client";

import { authenticateAction } from "@/features/auth/services/auth.service";
import { Button, Checkbox, Label, TextInput } from "flowbite-react";
import { FormSignInProps } from "./form-sign-in.types";
import Link from "next/link";
import React, { useRef, useState } from "react";
//import { useFormState } from "react-dom";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formSchema, FormSchema } from "../../utils/form";

export default function FormSignIn({ messages: msg }: FormSignInProps) {
  // initialize the useForm hook with the Zod resolver and default values
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const {
    register,
    handleSubmit,
    // setValue,
    formState: { errors /* isSubmitting */ },
  } = form;

  const formRef = useRef<HTMLFormElement>(null);
  //const [_state, formAction] = useFormState(authenticateAction, {});
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* e: React.MouseEvent<HTMLButtonElement>, */
  const onSubmitForm: SubmitHandler<FormSchema> = async function () {
    //e
    //e.preventDefault();
    setPending(true);
    //e.currentTarget.form?.requestSubmit();
    setErrorMessage(null);
    try {
      if (formRef.current) {
        const formData = new FormData(formRef.current);
        let response = await authenticateAction(
          {},
          formData, //new FormData(e as HTMLFormElement), //data
        );
        if (response && !response.success) {
          setPending(false);
          setErrorMessage(
            (response.message == "Invalid credentials"
              ? msg.invalidCredentials
              : response.message) || null,
          );
        }
      }
    } catch (error) {
      setPending(false);
      setErrorMessage((error as Error).message);
    }
  };

  return (
    <form
      ref={formRef}
      className="mt-8 space-y-6"
      onSubmit={handleSubmit(onSubmitForm)}
    >
      {/*  onSubmit={handleSubmit(onSubmitForm)} action={formAction} action={formAction}*/}
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="email">{msg.emailLabel}</Label>
        <TextInput
          id="email"
          /* name="email" */
          placeholder={msg.emailPlaceHolder}
          type="text"
          className={errors.email ? "animate-pulse ring-red-500" : ""}
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
          className={errors.password ? "animate-pulse ring-red-500" : ""}
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
      {errorMessage && <div className="text-red-500 mb-4">{errorMessage}</div>}
      <div className="mb-6">
        <Button
          color="blue"
          theme={{ inner: { base: "px-5 py-3" } }}
          className="w-full px-0 py-px submit"
          isProcessing={pending}
          aria-disabled={pending}
          /*  disabled={isSubmitting}
          onClick={onSubmitForm} */
          type="submit"
        >
          {msg.buttonSubmitLabel}
        </Button>
      </div>
    </form>
  );
}

"use client";

import {
  authenticateAction,
  signInWithMicrosoft,
} from "@/features/auth/services/auth.service";
import { Button } from "flowbite-react";
import { Windows } from "flowbite-react-icons/solid";
import { FormSignInProps } from "./form-sign-in.types";
import React, { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formSchema, FormSchema } from "../../services/auth.service.types";
import SignIn from "./sign-in";
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
  const [showLogin, setShowLogin] = useState(false);

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
    <form className="space-y-6" action={formAction}>
      {showLogin ? (
        <SignIn
          msg={msg}
          register={register}
          _state={_state}
          pending={pending}
          onSubmitForm={onSubmitForm}
          getMessages={getMessages}
          setShowLogin={setShowLogin}
        />
      ) : (
        <div className="flex flex-col gap-y-2">
          <Button
            color="blue"
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
            type="submit"
            formAction={signInWithMicrosoft}
          >
            <div className="flex items-center justify-center gap-2">
              <Windows className="h-5 w-5" />
              {msg.buttonContinueWithMicrosoft}
            </div>
          </Button>
          <div className="flex gap-1 flex-col text-sm justify-center items-center text-gray-500">
            <p>o</p>
            <a
              href="#"
              className="text-center hover:underline cursor-pointer text-blue-700 text-md"
              onClick={() => setShowLogin(true)}
            >
              {msg.buttonContinueWithEmail}
            </a>
          </div>
        </div>
      )}
    </form>
  );
}

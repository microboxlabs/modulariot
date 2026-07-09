"use client";

import { Label, TextInput, Button } from "flowbite-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { RegisterFormMessages } from "./form-sign-in.types";
import { LoginDivider } from "../login-divider";

const registerSchema = z
  .object({
    name: z.string().min(1),
    lastname: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

type RegisterSchema = z.infer<typeof registerSchema>;

export default function RegisterForm({
  msg,
  onBack,
}: Readonly<{
  msg: RegisterFormMessages;
  onBack: () => void;
}>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterSchema>({ resolver: zodResolver(registerSchema) });

  // No self-registration backend exists yet; this only validates client-side.
  const onSubmit = handleSubmit(() => {});

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="name">{msg.nameLabel}</Label>
        <TextInput
          id="name"
          placeholder={msg.namePlaceholder}
          type="text"
          {...register("name")}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="lastname">{msg.lastnameLabel}</Label>
        <TextInput
          id="lastname"
          placeholder={msg.lastnamePlaceholder}
          type="text"
          {...register("lastname")}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="register-email">{msg.emailLabel}</Label>
        <TextInput
          id="register-email"
          placeholder={msg.emailPlaceholder}
          type="text"
          {...register("email")}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="register-password">{msg.passwordLabel}</Label>
        <TextInput
          id="register-password"
          placeholder="••••••••"
          type="password"
          {...register("password")}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="confirm-password">{msg.confirmPasswordLabel}</Label>
        <TextInput
          id="confirm-password"
          placeholder="••••••••"
          type="password"
          className={
            errors.confirmPassword
              ? "animate-pulse border-2 border-rose-500"
              : ""
          }
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-red-600 dark:text-red-500">
            {msg.passwordMismatchError}
          </p>
        )}
      </div>
      <div>
        <Button color="blue" type="submit" className="w-full px-0 py-px">
          {msg.submitLabel}
        </Button>
        <div className="mt-2">
          <LoginDivider text="o" />
        </div>
        <div className="mt-2 flex justify-center text-sm text-gray-500">
          <a
            href="#"
            className="text-center hover:underline cursor-pointer text-blue-700"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
          >
            {msg.backToLoginLabel}
          </a>
        </div>
      </div>
    </form>
  );
}

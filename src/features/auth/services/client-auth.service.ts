"use client";

import { signIn, signOut } from "next-auth/react";
import { AuthenticateActionState } from "./auth.service.types";
import { AuthError } from "next-auth";

export async function authenticateAction(
  prevState: AuthenticateActionState,
  formData: FormData,
): Promise<AuthenticateActionState> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });
    return { success: true, status: 200 };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            success: false,
            message: "Invalid credentials",
            status: 403,
          };
        default:
          return { success: false, message: "An error occurred", status: 500 };
      }
    }
    throw error;
  }
}

export async function signOutAction(): Promise<{ url: string }> {
  return await signOut({ redirect: false });
}

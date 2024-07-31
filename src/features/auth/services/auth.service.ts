"use server";

import { AuthError } from "next-auth";
import type { User } from "next-auth";
import { SignInCredentials } from "./auth.service.types";
import { signIn } from "@/auth";
import {
  alfrescoApi,
  peopleApi,
} from "@/features/common/providers/alfresco-api.provider";
export async function signInWithCredentials(
  credentials: Record<keyof SignInCredentials, string>,
): Promise<User | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // const result: string =
    await alfrescoApi.login(credentials.email, credentials.password);

    const person = await peopleApi.getPerson("-me-");

    return {
      id: person.entry.id,
      name: person.entry.displayName,
      email: person.entry.email,
    };

    // id?: string
    // name?: string | null
    // email?: string | null
    // image?: string | null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    throw new AuthError({
      type: "CredentialsSignin",
      message: "Invalid credentials",
    });
  }
}

export async function authenticateAction(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: "/",
    });
    return "success";
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials";
        default:
          return "Something went wrong";
      }
    }
    throw error;
  }
}

"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import type { User } from "next-auth";
import {
  SignInCredentials,
  AuthenticateActionState,
} from "./auth.service.types";
import { signIn } from "@/auth";
import { alfrescoApi } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { PeopleApi } from "@alfresco/js-api";
export async function signInWithCredentials(
  credentials: Record<keyof SignInCredentials, string>,
): Promise<User | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ticket: string = await alfrescoApi.login(
      credentials.email,
      credentials.password,
    );

    const peopleApi = new PeopleApi(alfrescoApi.contentClient);
    const person = await peopleApi.getPerson("-me-");

    return {
      id: person.entry.id,
      name: person.entry.displayName,
      email: person.entry.email,
      ticket,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    throw new CredentialsSignin({
      message: "Invalid credentials",
      status: 403,
    });
  }
}

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

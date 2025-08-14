"use server";
import "server-only";

import { AuthError, CredentialsSignin } from "next-auth";
import type { User } from "next-auth";
import {
  AuthenticateActionState,
  formSchema,
  SignInCredentials,
} from "./auth.service.types";
import { PeopleApi, AlfrescoApi } from "@alfresco/js-api";
import { auth, signIn } from "@/auth";
import { redirectWithLang } from "./navigation.service";
import { logger } from "@/lib/logger";

export async function signInWithCredentials(
  credentials: Record<keyof SignInCredentials, string>,
): Promise<User | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const alfrescoApi = new AlfrescoApi({
      hostEcm: process.env.ECM_API_URL,
      provider: process.env.AUTH_PROVIDER,
      contextRoot: process.env.CONTEXT_ROOT,
    });
    const ticket: string = (await alfrescoApi.login(
      credentials.email as string,
      credentials.password as string,
    )) as string;

    const peopleApi = new PeopleApi(alfrescoApi);
    const person = await peopleApi.getPerson("-me-");

    return {
      id: person.entry.id,
      name: person.entry.displayName,
      email: person.entry.email,
      groups: [],
      ticket,
    };
  } catch (error) {
    throw new CredentialsSignin({
      message: "Invalid credentials",
      status: 403,
    });
  }
}

export async function signInWithMicrosoft(): Promise<void> {
  await signIn("microsoft-entra-id", { redirectTo: "/app" });
}

export async function authenticateAction(
  prevState: AuthenticateActionState,
  formData: FormData,
): Promise<AuthenticateActionState> {
  try {
    const validatedFields = formSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!validatedFields.success) {
      return {
        success: false,
        dataErrors: validatedFields.error.flatten().fieldErrors,
        message: "Invalid form data",
      };
    }
    const result: unknown = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });
    logger.info("result--------------------------------");
    logger.info(result);

    const hasErrorField = (value: unknown): value is { error?: string } => {
      return typeof value === "object" && value !== null && "error" in value;
    };
    if (hasErrorField(result) && result.error) {
      logger.error(result.error);
    }
    const session = await auth();
    logger.info("session--------------------------------");
    logger.info(session);
    redirectWithLang("/shipping");
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

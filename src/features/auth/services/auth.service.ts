import "server-only";

import { CredentialsSignin } from "next-auth";
import type { User } from "next-auth";
import { SignInCredentials } from "./auth.service.types";
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

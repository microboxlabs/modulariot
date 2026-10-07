"use client";

import useSWR from "swr";
import { ApiError, getJson, sendEmpty, sendJson } from "../data/json-client";

const MAIL_URL = "/app/api/admin/platform/mail";

/** Mirrors `PlatformMailService.PlatformMailView`. */
export interface PlatformMail {
  configured: boolean;
  connectionId: string | null;
  from: string | null;
  keyPreview: string | null;
  status: string | null;
  lastTestedAt: string | null;
  lastTestResult: boolean | null;
}

/** `apiKey`: required the first time; blank keeps the stored key. */
export interface SetPlatformMail {
  from: string;
  apiKey: string;
}

export interface PlatformMailTest {
  success: boolean;
  testedAt: string;
  message: string | null;
}

/** The platform email sender, with save, remove and test. */
export function usePlatformMail() {
  const { data, error, isLoading, mutate } = useSWR<PlatformMail, ApiError>(
    "platform-mail",
    () => getJson<PlatformMail>(MAIL_URL),
    { revalidateOnFocus: false }
  );

  const save = async (value: SetPlatformMail) => {
    const saved = await sendJson<PlatformMail>("PUT", MAIL_URL, value);
    await mutate(saved, { revalidate: false });
  };

  const remove = async () => {
    await sendEmpty("DELETE", MAIL_URL);
    await mutate();
  };

  const test = async () => {
    const result = await sendJson<PlatformMailTest>(
      "POST",
      `${MAIL_URL}/test`,
      {}
    );
    await mutate();
    return result;
  };

  return {
    mail: data ?? null,
    isLoading,
    error: error ?? null,
    save,
    remove,
    test,
  };
}

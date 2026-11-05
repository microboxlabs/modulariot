"use client";

import useSWR from "swr";
import { ApiError, getJson, sendEmpty, sendJson } from "../data/json-client";

const URL = "/app/api/admin/platform/vehicle-images";

/** Mirrors `PlatformVehicleImagesService.PlatformVehicleImagesView`. */
export interface PlatformVehicleImages {
  configured: boolean;
  connectionId: string | null;
  apiKey: string | null;
  secretPreview: string | null;
  status: string | null;
  lastTestedAt: string | null;
  lastTestResult: boolean | null;
}

/** `apiSecret`: required the first time; blank keeps the stored secret. */
export interface SetPlatformVehicleImages {
  apiKey: string;
  apiSecret: string;
}

export interface PlatformVehicleImagesTest {
  success: boolean;
  testedAt: string;
  message: string | null;
}

/** The platform vehicle image provider, with save, remove and test. */
export function usePlatformVehicleImages() {
  const { data, error, isLoading, mutate } = useSWR<
    PlatformVehicleImages,
    ApiError
  >("platform-vehicle-images", () => getJson<PlatformVehicleImages>(URL), {
    revalidateOnFocus: false,
  });

  const save = async (value: SetPlatformVehicleImages) => {
    const saved = await sendJson<PlatformVehicleImages>("PUT", URL, value);
    await mutate(saved, { revalidate: false });
  };

  const remove = async () => {
    await sendEmpty("DELETE", URL);
    await mutate();
  };

  const test = async () => {
    const result = await sendJson<PlatformVehicleImagesTest>(
      "POST",
      `${URL}/test`,
      {}
    );
    await mutate();
    return result;
  };

  return {
    provider: data ?? null,
    isLoading,
    error: error ?? null,
    save,
    remove,
    test,
  };
}

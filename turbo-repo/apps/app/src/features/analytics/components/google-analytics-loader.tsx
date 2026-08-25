"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";

export function GoogleAnalyticsLoader() {
  const runtimeConfig = useRuntimeConfig();

  if (!runtimeConfig?.GA_MEASUREMENT_ID) return null;

  return <GoogleAnalytics gaId={runtimeConfig.GA_MEASUREMENT_ID} />;
}

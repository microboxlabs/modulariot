"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { RuntimeConfig } from "./runtime-config.types";

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

let cachedConfig: RuntimeConfig | null = null;
let fetchPromise: Promise<RuntimeConfig> | null = null;

function fetchConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) return Promise.resolve(cachedConfig);
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/app/api/runtime-config")
    .then((res) => {
      if (!res.ok) throw new Error(`Runtime config fetch failed: ${res.status}`);
      return res.json();
    })
    .then((data: RuntimeConfig) => {
      cachedConfig = data;
      return data;
    })
    .catch((err) => {
      fetchPromise = null;
      throw err;
    });

  return fetchPromise;
}

export function RuntimeConfigProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [config, setConfig] = useState<RuntimeConfig | null>(cachedConfig);
  const [attempt, setAttempt] = useState(0);

  // Retry with backoff: pages that wait for the config would stay blank
  // after a single failed request.
  useEffect(() => {
    if (config) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    fetchConfig()
      .then(setConfig)
      .catch((err) => {
        console.error(err);
        retry = setTimeout(
          () => setAttempt((n) => n + 1),
          Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt)
        );
      });
    return () => clearTimeout(retry);
  }, [config, attempt]);

  return (
    <RuntimeConfigContext.Provider value={config}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig(): RuntimeConfig | null {
  return useContext(RuntimeConfigContext);
}

/** The loaded config for code outside React, or null before it arrives. */
export function getRuntimeConfig(): RuntimeConfig | null {
  return cachedConfig;
}

/** Renders children only once the runtime config has loaded. */
export function RuntimeConfigReady({ children }: Readonly<{ children: React.ReactNode }>) {
  return useRuntimeConfig() ? children : null;
}

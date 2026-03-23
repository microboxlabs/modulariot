"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { RuntimeConfig } from "./runtime-config.types";

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

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

export function RuntimeConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RuntimeConfig | null>(cachedConfig);

  useEffect(() => {
    if (config) return;
    fetchConfig().then(setConfig);
  }, [config]);

  return (
    <RuntimeConfigContext.Provider value={config}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig(): RuntimeConfig | null {
  return useContext(RuntimeConfigContext);
}

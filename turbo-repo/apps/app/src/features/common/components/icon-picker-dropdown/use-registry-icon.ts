"use client";

import { useEffect, useState, type ComponentType } from "react";
import { ICON_REGISTRY } from "./icon-registry";

type IconComponent = ComponentType<{ className?: string }>;

/** The icon for a registry key, loaded on first use; undefined while loading or for an unknown key. */
export function useRegistryIcon(
  key: string | null | undefined
): IconComponent | undefined {
  const [icon, setIcon] = useState<IconComponent>();

  useEffect(() => {
    const entry = key ? ICON_REGISTRY[key] : undefined;
    if (!entry) {
      setIcon(undefined);
      return;
    }
    let cancelled = false;
    entry
      .load()
      .then((mod) => {
        // A function in state must be wrapped, or React calls it as an updater.
        if (!cancelled) setIcon(() => mod.default);
      })
      .catch(() => {
        if (!cancelled) setIcon(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return icon;
}

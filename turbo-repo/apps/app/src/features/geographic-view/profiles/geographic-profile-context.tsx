"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_GEOGRAPHIC_PROFILE,
  GEOGRAPHIC_PROFILES,
  profileHasCapability,
  type GeographicCapability,
  type GeographicProfileId,
} from "./geographic-profiles";

export type GeographicMapViewId = "places" | "test";

type GeographicProfileContextValue = {
  profileId: GeographicProfileId;
  setProfileId: (id: GeographicProfileId) => void;
  activeView: GeographicMapViewId | null;
  setActiveView: (id: GeographicMapViewId | null) => void;
  can: (capability: GeographicCapability) => boolean;
};

const GeographicProfileContext =
  createContext<GeographicProfileContextValue | null>(null);

export function GeographicProfileProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [profileId, setProfileIdState] = useState<GeographicProfileId>(
    DEFAULT_GEOGRAPHIC_PROFILE
  );
  const [activeView, setActiveViewState] =
    useState<GeographicMapViewId | null>(null);

  const setProfileId = useCallback((id: GeographicProfileId) => {
    if (!GEOGRAPHIC_PROFILES[id].enabled) return;
    setProfileIdState(id);
    setActiveViewState((current) => {
      if (current === "places" && !profileHasCapability(id, "placesEditor")) {
        return null;
      }
      if (current === "test" && !profileHasCapability(id, "testView")) {
        return null;
      }
      return current;
    });
  }, []);

  const setActiveView = useCallback(
    (id: GeographicMapViewId | null) => {
      if (id === "places" && !profileHasCapability(profileId, "placesEditor")) {
        return;
      }
      if (id === "test" && !profileHasCapability(profileId, "testView")) {
        return;
      }
      setActiveViewState(id);
    },
    [profileId]
  );

  const can = useCallback(
    (capability: GeographicCapability) =>
      profileHasCapability(profileId, capability),
    [profileId]
  );

  const value = useMemo(
    () => ({ profileId, setProfileId, activeView, setActiveView, can }),
    [profileId, setProfileId, activeView, setActiveView, can]
  );

  return (
    <GeographicProfileContext.Provider value={value}>
      {children}
    </GeographicProfileContext.Provider>
  );
}

export function useGeographicProfile(): GeographicProfileContextValue {
  const ctx = useContext(GeographicProfileContext);
  if (!ctx) {
    throw new Error(
      "useGeographicProfile must be used within GeographicProfileProvider"
    );
  }
  return ctx;
}

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

export type GeographicMapViewId = "places";

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
  const [profileIdActual, setProfileIdActual] = useState<GeographicProfileId>(
    DEFAULT_GEOGRAPHIC_PROFILE
  );
  const [activeViewActual, setActiveViewActual] =
    useState<GeographicMapViewId | null>(null);
  // Lugares se abre con o sin el permiso "Editor de lugares": sin él es de
  // solo lectura (lo decide el editor, no el perfil)
  const tiene = profileHasCapability;

  const setProfileId = useCallback(
    (id: GeographicProfileId) => {
      if (!GEOGRAPHIC_PROFILES[id].enabled) return;
      setProfileIdActual(id);
      setActiveViewActual((current) => {
        if (current === "places" && !tiene(id, "placesEditor")) return null;
        return current;
      });
    },
    [tiene]
  );

  const setActiveView = useCallback(
    (id: GeographicMapViewId | null) => {
      if (id === "places" && !tiene(profileIdActual, "placesEditor")) return;
      setActiveViewActual(id);
    },
    [profileIdActual, tiene]
  );

  const can = useCallback(
    (capability: GeographicCapability) => tiene(profileIdActual, capability),
    [profileIdActual, tiene]
  );

  const value = useMemo(
    () => ({
      profileId: profileIdActual,
      setProfileId,
      activeView: activeViewActual,
      setActiveView,
      can,
    }),
    [profileIdActual, setProfileId, activeViewActual, setActiveView, can]
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

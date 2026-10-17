"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePermisoEditorLugares } from "./places-permission";
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
  const [profileId, setProfileIdState] = useState<GeographicProfileId>(
    DEFAULT_GEOGRAPHIC_PROFILE
  );
  const [activeView, setActiveViewState] = useState<GeographicMapViewId | null>(
    null
  );
  // el editor de lugares necesita además el permiso "Editor de lugares"
  const permisoLugares = usePermisoEditorLugares();
  const tiene = useCallback(
    (id: GeographicProfileId, capability: GeographicCapability) =>
      profileHasCapability(id, capability) &&
      (capability !== "placesEditor" || permisoLugares),
    [permisoLugares]
  );
  // sin el permiso (o si se lo quitan) Lugares se cierra
  useEffect(() => {
    if (!permisoLugares) setActiveViewState((v) => (v === "places" ? null : v));
  }, [permisoLugares]);

  const setProfileId = useCallback(
    (id: GeographicProfileId) => {
      if (!GEOGRAPHIC_PROFILES[id].enabled) return;
      setProfileIdState(id);
      setActiveViewState((current) => {
        if (current === "places" && !tiene(id, "placesEditor")) return null;
        return current;
      });
    },
    [tiene]
  );

  const setActiveView = useCallback(
    (id: GeographicMapViewId | null) => {
      if (id === "places" && !tiene(profileId, "placesEditor")) return;
      setActiveViewState(id);
    },
    [profileId, tiene]
  );

  const can = useCallback(
    (capability: GeographicCapability) => tiene(profileId, capability),
    [profileId, tiene]
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

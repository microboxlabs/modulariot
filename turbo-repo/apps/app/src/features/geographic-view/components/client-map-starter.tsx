"use client";

import { useRef } from "react";
import MapVisualization from "./map-visualization";
import {
  useMapPositions,
  useMapPositionsResume,
} from "@/features/common/providers/client-api.provider";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { MapPositionResume } from "../types/map";
import { useGeographicProfile } from "../profiles/geographic-profile-context";

export default function ClientMapStarter({ dict }: { dict: I18nRecord }) {
  const { activeView } = useGeographicProfile();
  const trucksEnabled = activeView !== "places";
  const { positions: mapPositions, isLoading, error } = useMapPositions({
    enabled: trucksEnabled,
  });

  const { data: mapPositionsResume } = useMapPositionsResume({
    enabled: trucksEnabled,
  });

  const mapShown = useRef(false);
  const waitingForTrucks = trucksEnabled && isLoading && !mapShown.current;

  if (!waitingForTrucks) {
    mapShown.current = true;
  }

  if (waitingForTrucks) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 animate-pulse">
        <div className="absolute top-5 left-5 flex flex-col gap-1 items-center justify-center">
          <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
          <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
          <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
          <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
        </div>
        <div className="absolute top-5 right-5 flex flex-col gap-1 items-center justify-center">
          <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    console.error("Map error:", error);
    // Continue rendering with empty data instead of showing error
  }

  return (
    <MapVisualization
      dict={dict}
      mapPositions={trucksEnabled ? mapPositions : []}
      mapPositionsResume={mapPositionsResume as MapPositionResume}
      isLoading={trucksEnabled && isLoading}
    />
  );
}

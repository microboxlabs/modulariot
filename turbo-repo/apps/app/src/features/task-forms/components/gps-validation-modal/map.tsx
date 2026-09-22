/*
Since the map was loaded on client side,
we need to make this component client rendered as well else error occurs
*/
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl";
import { toast } from "sonner";
import {
  HiOutlineViewfinderCircle,
  HiOutlineSquare2Stack,
} from "react-icons/hi2";
import MapVisualization from "@/features/map-visualization/map-visualization";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer";
import { MapComponentProps } from "./gps-validation-modal.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

const defaultMapZoom = 5;

function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

const controlButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";

export default function MapComponent({ pointer, msg }: MapComponentProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const cards = (msg?.cards as I18nRecord | undefined) ?? (msg as I18nRecord | undefined);
  const copyLabel = (cards?.copyGoogleMapsLink as string) || "Copy Google Maps link";
  const centerLabel = (cards?.centerOnElement as string) || "Center on element";
  const copiedMsg = (cards?.googleMapsLinkCopied as string) || "Google Maps link copied";
  const copyErrorMsg =
    (cards?.googleMapsLinkCopyError as string) || "Couldn't copy the link";

  const layers = useMemo(
    () => [
      new PinLayer({
        id: "gps-validation-pin-layer",
        data: [
          {
            assetid: "gps-validation",
            latitude: pointer.lat,
            longitude: pointer.lng,
            heading: 0,
            speed: 0,
            location: "",
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    ],
    [pointer.lat, pointer.lng]
  );

  const centerOnElement = useCallback(() => {
    mapRef.current?.flyTo({
      center: [pointer.lng, pointer.lat],
      zoom: defaultMapZoom,
      duration: 500,
    });
  }, [pointer.lat, pointer.lng]);

  useEffect(() => {
    if (isMapLoaded) {
      centerOnElement();
    }
  }, [isMapLoaded, centerOnElement]);

  const handleZoomChange = useCallback(() => {
    setIsMapLoaded(true);
  }, []);

  const copyGoogleMapsUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        buildGoogleMapsUrl(pointer.lat, pointer.lng)
      );
      toast.success(copiedMsg);
    } catch {
      toast.error(copyErrorMsg);
    }
  }, [pointer.lat, pointer.lng, copiedMsg, copyErrorMsg]);

  return (
    <div className="relative w-full h-50">
      <MapVisualization
        mapStyle="satellite"
        layers={layers}
        mapRef={mapRef}
        onZoomChange={handleZoomChange}
      />
      <div className="absolute top-2 right-2 z-20 flex flex-col gap-2 pointer-events-none">
        <button
          type="button"
          onClick={centerOnElement}
          aria-label={centerLabel}
          title={centerLabel}
          className={`${controlButtonClass} pointer-events-auto`}
        >
          <HiOutlineViewfinderCircle className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={copyGoogleMapsUrl}
          aria-label={copyLabel}
          title={copyLabel}
          className={`${controlButtonClass} pointer-events-auto`}
        >
          <HiOutlineSquare2Stack className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

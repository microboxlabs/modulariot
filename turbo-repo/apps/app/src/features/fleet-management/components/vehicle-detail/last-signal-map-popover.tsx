"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { GoogleMap, Marker } from "@react-google-maps/api";
import Map, { useControl } from "react-map-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { IconLayer } from "@deck.gl/layers";
import type { DeckProps } from "@deck.gl/core";
import type { StyleSpecification } from "mapbox-gl";
import {
  HiOutlineCamera,
  HiOutlineShare,
  HiOutlineLink,
  HiOutlineCheck,
} from "react-icons/hi2";
import { MapProvider } from "@/features/google-maps/provider/google-maps.provider";
import { createSVGIcon } from "@/features/geographic-view/components/prototype/svg-generation";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

export type LastSignalMapVariant = "google" | "osm";

interface LastSignalMapPopoverProps {
  readonly latitude: number;
  readonly longitude: number;
  readonly dict: I18nRecord;
  readonly children: ReactNode;
  /** Which underlying map implementation to render. Defaults to `"osm"`. */
  readonly variant?: LastSignalMapVariant;
}

const POPOVER_WIDTH = 380;
const POPOVER_OFFSET = 12;
const MAP_HEIGHT = 180;
const MAP_ZOOM = 15;

const MAP_CONTAINER_STYLE = {
  width: "100%",
  height: `${MAP_HEIGHT}px`,
  borderRadius: "8px",
} as const;

const GOOGLE_MAP_OPTIONS: google.maps.MapOptions = {
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  tilt: 0,
  gestureHandling: "cooperative",
  mapTypeId: "roadmap",
};

// Inline OSM raster style — uses OpenStreetMap's public tile server as the
// single raster source. Keeps the OSM variant free of any Mapbox style
// reference so the look matches the "our map" look elsewhere in the app.
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function buildStaticMapUrl(latitude: number, longitude: number): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: "15",
    size: "640x400",
    scale: "2",
    maptype: "roadmap",
    markers: `color:red|${latitude},${longitude}`,
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

async function downloadSnapshot(
  latitude: number,
  longitude: number
): Promise<void> {
  const url = buildStaticMapUrl(latitude, longitude);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Static maps fetch failed: ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `last-signal-${latitude.toFixed(5)}-${longitude.toFixed(5)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function shareLocation(
  latitude: number,
  longitude: number,
  title: string
): Promise<boolean> {
  const url = buildGoogleMapsUrl(latitude, longitude);
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title, url });
      return true;
    } catch {
      // User cancelled or share failed — fall through to clipboard.
    }
  }
  await navigator.clipboard.writeText(url);
  return false;
}

// --- Google Maps variant. ---

function GoogleMapView({
  latitude,
  longitude,
}: {
  readonly latitude: number;
  readonly longitude: number;
}) {
  return (
    <MapProvider>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={{ lat: latitude, lng: longitude }}
        zoom={MAP_ZOOM}
        options={GOOGLE_MAP_OPTIONS}
      >
        <Marker position={{ lat: latitude, lng: longitude }} />
      </GoogleMap>
    </MapProvider>
  );
}

// --- OSM raster + custom pin variant. ---

function DeckGLOverlay(props: DeckProps) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay(props)
  );
  overlay.setProps(props);
  return null;
}

function OsmMapView({
  latitude,
  longitude,
}: {
  readonly latitude: number;
  readonly longitude: number;
}) {
  const runtimeConfig = useRuntimeConfig();
  const mapboxAccessToken = runtimeConfig?.MAPBOX_API_KEY ?? "";
  const isRuntimeConfigLoading = runtimeConfig === null;
  // Memoize the pin layer so deck.gl doesn't reconstruct the icon on every
  // parent render. `createSVGIcon(1, false)` is the "Happy" blue face — the
  // default look the app uses for a healthy vehicle pin.
  const layers = useMemo(
    () => [
      new IconLayer({
        id: "last-signal-pin",
        data: [{ longitude, latitude }],
        getIcon: () => ({
          url: createSVGIcon(1, false),
          width: 300,
          height: 500,
          anchorX: 150,
          anchorY: 310,
          mask: false,
        }),
        getPosition: (d: { longitude: number; latitude: number }) => [
          d.longitude,
          d.latitude,
        ],
        getSize: 50,
        pickable: false,
        parameters: { depthTest: false },
      }),
    ],
    [latitude, longitude]
  );

  return (
    <div
      style={MAP_CONTAINER_STYLE}
      className="relative overflow-hidden"
    >
      {!isRuntimeConfigLoading && (
        <Map
          mapboxAccessToken={mapboxAccessToken}
          mapStyle={OSM_STYLE}
          initialViewState={{
            longitude,
            latitude,
            zoom: MAP_ZOOM,
          }}
          attributionControl={false}
          dragRotate={false}
          touchPitch={false}
        >
          <DeckGLOverlay layers={layers} />
        </Map>
      )}
    </div>
  );
}

interface PopoverPosition {
  top: number;
  left: number;
}

export default function LastSignalMapPopover({
  latitude,
  longitude,
  dict,
  children,
  variant = "osm",
}: LastSignalMapPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDialogElement>(null);

  useEffect(() => setMounted(true), []);

  // Recompute viewport-positioned coords from the trigger rect. Called on
  // open, scroll, and resize so the popover tracks the button when the
  // surrounding overflow container scrolls.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const viewportWidth = window.innerWidth;
    const clampedLeft = Math.max(
      8,
      Math.min(centerX - POPOVER_WIDTH / 2, viewportWidth - POPOVER_WIDTH - 8)
    );
    setPosition({
      top: rect.bottom + POPOVER_OFFSET,
      left: clampedLeft,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = () => updatePosition();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [isOpen, updatePosition]);

  // Close when clicking outside the trigger or the popover content.
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildGoogleMapsUrl(latitude, longitude));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSnapshot = async () => {
    try {
      await downloadSnapshot(latitude, longitude);
    } catch {
      // Snapshot best-effort — nothing actionable if Google static maps fails.
    }
  };

  const handleShare = async () => {
    const shared = await shareLocation(
      latitude,
      longitude,
      tr("vehicleDetail.lastSignalMap.title", dict)
    );
    if (!shared) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const arrowLeft = (() => {
    const trigger = triggerRef.current;
    if (!trigger || !position) return POPOVER_WIDTH / 2;
    const rect = trigger.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const offset = centerX - position.left;
    return Math.max(16, Math.min(offset, POPOVER_WIDTH - 16));
  })();

  const popoverContent = mounted && isOpen && position ? (
    <dialog
      open
      ref={popoverRef}
      aria-label={tr("vehicleDetail.lastSignalMap.title", dict)}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 1000,
        border: "none",
        padding: 0,
        margin: 0,
        background: "transparent",
        maxWidth: "none",
        maxHeight: "none",
      }}
      className="rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
    >
      {/* Pointer arrow. */}
      <div
        className="absolute -top-2"
        style={{ left: arrowLeft - 6 }}
      >
        <div className="h-3 w-3 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" />
      </div>

      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {tr("vehicleDetail.lastSignalMap.title", dict)}
          </span>
          <a
            href={buildGoogleMapsUrl(latitude, longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
          >
            {tr("vehicleDetail.lastSignalMap.openInMaps", dict)}
          </a>
        </div>

        {variant === "google" ? (
          <GoogleMapView latitude={latitude} longitude={longitude} />
        ) : (
          <OsmMapView latitude={latitude} longitude={longitude} />
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleSnapshot}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            <HiOutlineCamera className="h-4 w-4" />
            <span className="truncate">
              {tr("vehicleDetail.lastSignalMap.snapshot", dict)}
            </span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            <HiOutlineShare className="h-4 w-4" />
            <span className="truncate">
              {tr("vehicleDetail.lastSignalMap.share", dict)}
            </span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {copied ? (
              <HiOutlineCheck className="h-4 w-4 text-green-500" />
            ) : (
              <HiOutlineLink className="h-4 w-4" />
            )}
            <span className="truncate">
              {copied
                ? tr("vehicleDetail.lastSignalMap.copied", dict)
                : tr("vehicleDetail.lastSignalMap.copyLink", dict)}
            </span>
          </button>
        </div>
      </div>
    </dialog>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex flex-col items-start text-left hover:opacity-80 transition-opacity cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {children}
      </button>
      {popoverContent && createPortal(popoverContent, document.body)}
    </>
  );
}

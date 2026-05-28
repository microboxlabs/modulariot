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
import type { MapRef } from "react-map-gl";
import {
  HiOutlineCamera,
  HiOutlineShare,
  HiOutlineLink,
  HiOutlineCheck,
} from "react-icons/hi2";
import MapVisualization from "@/features/map-visualization/map-visualization";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

interface LastSignalMapPopoverProps {
  readonly latitude: number;
  readonly longitude: number;
  readonly dict: I18nRecord;
  readonly children: ReactNode;
}

const POPOVER_WIDTH = 380;
const POPOVER_OFFSET = 12;
const MAP_HEIGHT = 180;

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

// --- Map display using the shared MapVisualization + PinLayer ---

function PopoverMapView({
  latitude,
  longitude,
}: {
  readonly latitude: number;
  readonly longitude: number;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const layers = useMemo(
    () => [
      new PinLayer({
        id: "last-signal-pin-layer",
        data: [
          {
            assetid: "last-signal",
            latitude,
            longitude,
            heading: 0,
            speed: 0,
            location: "",
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    ],
    [latitude, longitude]
  );

  useEffect(() => {
    if (isMapLoaded && mapRef.current) {
      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom: 14,
        duration: 500,
      });
    }
  }, [latitude, longitude, isMapLoaded]);

  const handleZoomChange = useCallback(() => {
    setIsMapLoaded(true);
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ height: MAP_HEIGHT }}>
      <MapVisualization
        mapStyle="satellite"
        layers={layers}
        mapRef={mapRef}
        onZoomChange={handleZoomChange}
      />
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
}: LastSignalMapPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

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

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
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
      // Snapshot best-effort.
    }
  };

  const handleShare = async () => {
    const shared = await shareLocation(
      latitude,
      longitude,
      tr("lastSignalMap.title", dict)
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
    <>
      {/* Backdrop — closes popover on click */}
      <div
        className="fixed inset-0 z-999 bg-black/20"
        onClick={() => setIsOpen(false)}
        aria-hidden
      />

      {/* Card */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-label={tr("lastSignalMap.title", dict)}
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          width: POPOVER_WIDTH,
          zIndex: 1000,
        }}
        className="rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        {/* Pointer arrow */}
        <div
          className="absolute -top-2"
          style={{ left: arrowLeft - 6 }}
        >
          <div className="h-3 w-3 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" />
        </div>

        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {tr("lastSignalMap.title", dict)}
            </span>
            <a
              href={buildGoogleMapsUrl(latitude, longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
            >
              {tr("lastSignalMap.openInMaps", dict)}
            </a>
          </div>

          <PopoverMapView latitude={latitude} longitude={longitude} />

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSnapshot}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <HiOutlineCamera className="h-4 w-4" />
              <span className="truncate">
                {tr("lastSignalMap.snapshot", dict)}
              </span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <HiOutlineShare className="h-4 w-4" />
              <span className="truncate">
                {tr("lastSignalMap.share", dict)}
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
                  ? tr("lastSignalMap.copied", dict)
                  : tr("lastSignalMap.copyLink", dict)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
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

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import VehicleCard from "./vehicle-card";
import EmptyAnimation from "@/features/symptoms/components/empty-animation";

const ITEMS_PER_PAGE = 9;

interface VehicleGridProps {
  readonly vehicles: Vehicle[];
  readonly dict: I18nRecord;
  readonly onSelectVehicle?: (plate: string) => void;
  readonly fetchLoading?: boolean;
}

export default function VehicleGrid({
  vehicles,
  dict,
  onSelectVehicle,
  fetchLoading = false,
}: VehicleGridProps) {
  const [isDetailed, setIsDetailed] = useState(true);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const visibleVehicles = vehicles.slice(0, visibleCount);
  const hasMore = visibleCount < vehicles.length;

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  // Reset state when vehicles prop changes
  useEffect(() => {
    clearLoadTimeout();
    setVisibleCount(Math.min(ITEMS_PER_PAGE, vehicles.length));
    setIsLoading(false);
  }, [vehicles, clearLoadTimeout]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return clearLoadTimeout;
  }, [clearLoadTimeout]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    // Simulate loading delay
    loadTimeoutRef.current = setTimeout(() => {
      setVisibleCount((prev) =>
        Math.min(prev + ITEMS_PER_PAGE, vehicles.length)
      );
      setIsLoading(false);
    }, 300);
  }, [isLoading, hasMore, vehicles.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {tr("vehicleGrid.title", dict)}
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {tr("vehicleGrid.vehicleCount", dict, {
              count: String(vehicles.length),
            })}
          </span>
        </div>
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            type="button"
            aria-pressed={isDetailed}
            onClick={() => setIsDetailed(true)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              isDetailed
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {tr("vehicleGrid.detailed", dict)}
          </button>
          <button
            type="button"
            aria-pressed={!isDetailed}
            onClick={() => setIsDetailed(false)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              isDetailed
                ? "text-gray-500 dark:text-gray-400"
                : "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
            }`}
          >
            {tr("vehicleGrid.simplified", dict)}
          </button>
        </div>
      </div>
      {!fetchLoading && vehicles.length === 0 ? (
        <div className="flex flex-col justify-center items-center ">
            <EmptyAnimation />
            <p className="text-lg text-gray-500 mt-5">
              {tr("vehicleGrid.emptyTitle", dict)}
            </p>
            <p className="text-sm font-light text-gray-400">
              {tr("vehicleGrid.emptyDescription", dict)}
            </p>
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {fetchLoading && vehicles.length === 0
            ? Array.from({ length: 9 }, (_, i) => `skeleton-${i}`).map((skeletonKey) => (
                <div
                  key={skeletonKey}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 h-32 animate-pulse"
                />
              ))
            : visibleVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  dict={dict}
                  isDetailed={isDetailed}
                  onSelect={onSelectVehicle}
                />
              ))}
        </div>
      )}
      {hasMore && (
        <div ref={loaderRef} className="flex justify-center py-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
              <span className="text-xs">{tr("vehicleGrid.loading", dict)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { StreamDevice, DeviceStatus } from "../types/device.types";
import { FaVideo, FaCircle } from "react-icons/fa";
import { I18nDictionary } from "@/features/i18n/i18n.service.types";

interface DeviceCardProps {
  device: StreamDevice;
  onClick?: (device: StreamDevice) => void;
  dict: I18nDictionary["liveStreams"];
}

const statusConfig: Record<DeviceStatus, { color: string; bgColor: string; key: string }> = {
  live: { color: "text-green-500", bgColor: "bg-green-500", key: "live" },
  offline: { color: "text-gray-400", bgColor: "bg-gray-400", key: "offline" },
  recording: { color: "text-red-500", bgColor: "bg-red-500", key: "recording" },
  error: { color: "text-yellow-500", bgColor: "bg-yellow-500", key: "error" },
};

export function DeviceCard({ device, onClick, dict }: DeviceCardProps) {
  const status = statusConfig[device.status];
  const isClickable = device.status === "live" || device.status === "recording";
  const statusLabel = dict[status.key as keyof typeof dict];

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden
        border border-gray-200 dark:border-gray-700
        transition-all duration-200
        ${isClickable ? "cursor-pointer hover:shadow-lg hover:border-primary-500" : "opacity-75"}
      `}
      onClick={() => isClickable && onClick?.(device)}
    >
      <div className="aspect-video bg-gray-900 relative flex items-center justify-center">
        {device.thumbnailUrl ? (
          <img
            src={device.thumbnailUrl}
            alt={device.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <FaVideo className="w-12 h-12 text-gray-600" />
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
          <FaCircle className={`w-2 h-2 ${status.color} ${device.status === "live" ? "animate-pulse" : ""}`} />
          <span className="text-xs text-white font-medium">{statusLabel}</span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
          {device.name}
        </h3>
        {device.lastSeen && device.status === "offline" && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {dict.lastSeen}: {device.lastSeen}
          </p>
        )}
      </div>
    </div>
  );
}

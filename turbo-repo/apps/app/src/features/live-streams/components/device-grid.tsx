"use client";

import { useState } from "react";
import { Button, ButtonGroup } from "flowbite-react";
import { StreamDevice, DeviceStatus } from "../types/device.types";
import { DeviceCard } from "./device-card";
import { I18nDictionary } from "@/features/i18n/i18n.service.types";

interface DeviceGridProps {
  devices: StreamDevice[];
  onDeviceClick?: (device: StreamDevice) => void;
  dict: I18nDictionary["liveStreams"];
}

export function DeviceGrid({ devices, onDeviceClick, dict }: DeviceGridProps) {
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | "all">("all");

  const filteredDevices = devices.filter((device) => {
    return statusFilter === "all" || device.status === statusFilter;
  });

  const liveCount = devices.filter((d) => d.status === "live").length;
  const offlineCount = devices.filter((d) => d.status === "offline").length;

  const activeClassName =
    "bg-gray-100 dark:bg-gray-700 cursor-default hover:bg-gray-100 dark:hover:bg-gray-700";

  return (
    <div className="flex flex-col h-full pt-4">
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-gray-600 dark:text-gray-400">{liveCount} {dict.live}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            <span className="text-gray-600 dark:text-gray-400">{offlineCount} {dict.offline}</span>
          </span>
        </div>

        <ButtonGroup>
          <Button
            color="alternative"
            onClick={() => setStatusFilter("all")}
            disabled={statusFilter === "all"}
            className={statusFilter === "all" ? activeClassName : ""}
          >
            {dict.all}
          </Button>
          <Button
            color="alternative"
            onClick={() => setStatusFilter("live")}
            disabled={statusFilter === "live"}
            className={statusFilter === "live" ? activeClassName : ""}
          >
            {dict.live}
          </Button>
          <Button
            color="alternative"
            onClick={() => setStatusFilter("offline")}
            disabled={statusFilter === "offline"}
            className={statusFilter === "offline" ? activeClassName : ""}
          >
            {dict.offline}
          </Button>
        </ButtonGroup>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredDevices.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {dict.noDevicesFound}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDevices.map((device) => (
              <DeviceCard key={device.id} device={device} onClick={onDeviceClick} dict={dict} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

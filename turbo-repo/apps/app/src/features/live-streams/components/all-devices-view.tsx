"use client";

import { useRouter } from "next/navigation";
import { StreamDevice } from "../types/device.types";
import { DeviceGrid } from "./device-grid";
import { I18nDictionary } from "@/features/i18n/i18n.service.types";

interface AllDevicesViewProps {
  devices: StreamDevice[];
  lang: string;
  dict: I18nDictionary["liveStreams"];
}

export function AllDevicesView({ devices, lang, dict }: AllDevicesViewProps) {
  const router = useRouter();

  const handleDeviceClick = (device: StreamDevice) => {
    router.push(`/${lang}/live-streams/player/${device.id}`);
  };

  return <DeviceGrid devices={devices} onDeviceClick={handleDeviceClick} dict={dict} />;
}

export type DeviceStatus = "live" | "offline" | "recording" | "error";

export type DeviceLocation = "facility-scl" | "truck-bed" | "other";

export interface StreamDevice {
  id: string;
  name: string;
  location: DeviceLocation;
  status: DeviceStatus;
  streamUrl?: string;
  lastSeen?: string;
  thumbnailUrl?: string;
}

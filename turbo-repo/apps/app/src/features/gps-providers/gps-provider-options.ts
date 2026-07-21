export interface GpsProviderOption {
  id: string;
  name: string;
}

export const GPS_PROVIDER_OPTIONS: GpsProviderOption[] = [
  { id: "garmin", name: "Garmin" },
  { id: "queclink", name: "QuecLink" },
  { id: "redd-gps", name: "REDD GPS" },
  { id: "black-gps", name: "Black GPS" },
  { id: "other", name: "Other" },
];

export function gpsProviderNameById(id: string): string {
  return (
    GPS_PROVIDER_OPTIONS.find((option) => option.id === id)?.name ?? id
  );
}

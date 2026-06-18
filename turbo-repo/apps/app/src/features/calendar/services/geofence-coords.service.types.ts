export interface GeofencePoint {
  latitude: number;
  longitude: number;
}

export interface GeofenceCoordsResponse {
  origin: GeofencePoint | null;
  destination: GeofencePoint | null;
}

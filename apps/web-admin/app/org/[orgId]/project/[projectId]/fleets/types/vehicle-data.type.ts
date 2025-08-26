export type FleetStatus = "ok" | "warn" | "error";

export type VehicleData = {
	id: string;
	route: string;
	speed?: number;
	heading?: number;
	asset_id: string;
	location?: string; // GeoJSON Point
	longitude?: number;
	latitude?: number;
	is_moving: boolean;
	timestamp: string;
	symptoms_condition: number
	speed_limit_condition: number | null;
	speed_limit?: number | null;
};
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

/*
"in_trip": false,
"trip_id": null,
"is_moving": true,
"request_id": "72e760d6d3c66036a1ba845a93a10295",
"start_time": null,
"driver_name": null,
"lost_signal": false,
"carrier_name": null,
"gps_provider": "Digiplus-Jaulas",
"engine_status": "Off",
"associate_symptoms": null,
"estimated_arrival_time": null
*/
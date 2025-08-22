import { Fleets } from "@modulariot/ui/fleets/fleets";
import { type VehicleData } from "@modulariot/ui/fleets/types/fleet.types";

export const TEST_POSITIONS: VehicleData[] = [
	{
		id: "veh-001",
		assetId: "AA-BB-11",
		latitude: -33.4489,
		longitude: -70.6693,
		speed: 42,
		status: "ok",
		timestamp: new Date().toISOString(),
		symptoms_condition: 0,
		speed_limit_condition: 1
	},
	{
		id: "veh-002",
		assetId: "CC-DD-22",
		latitude: -33.0207,
		longitude: -71.5518,
		speed: 0,
		status: "warn",
		timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
		symptoms_condition: 1,
		speed_limit_condition: 0
	},
	{
		id: "veh-003",
		assetId: "EE-FF-33",
		latitude: -36.8269,
		longitude: -73.0498,
		speed: 67,
		status: "error",
		timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
		symptoms_condition: 2,
		speed_limit_condition: 2,
		speed_limit: 60
	},
	{
		id: "veh-004",
		assetId: "GG-HH-44",
		location: "0101000020E61000002E1D739EB19351C00D5531957EC637C0",
		speed: 28,
		status: "ok",
		timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
		symptoms_condition: 0,
		speed_limit_condition: null
	},
]; 

export default function FleetsPage() {
	return (
		<div className="flex flex-col flex-grow h-full w-full">
			{
				/*
					<h1 className="text-2xl font-bold mb-4 mt-8 mx-8">Fleets</h1>       
				*/
			}
			<Fleets data={TEST_POSITIONS} />
		</div>
	);
}
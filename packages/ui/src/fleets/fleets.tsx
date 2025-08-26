"use client"

import { MapView } from "./map/Map";
import { type VehicleData } from "./types/fleet.types";
import FleetSideBar from "./side-bar/fleet-side-bar"
import LabelledButton from "../buttons/labelled-button";

/*
	TODO:
		- Implement Download and Screenshot functionality
		- Add Data to the sidebar monitoring tab
		- Add Data to the symptoms tab
*/

export function Fleets({ data }: { data: VehicleData[] }) {
	return (
		<div className="flex flex-col flex-grow relative">
			{/* Map */}
			<MapView data={data} />
			
			{/* SideBar */}
			<FleetSideBar />

			{/* filters */}
			<div className="absolute top-0 left-0 z-10 p-2 flex flex-col gap-2">
				<LabelledButton
					label={"Filter"}
					border="border"
				>
					E
				</LabelledButton>
				<LabelledButton
					label={"Filter"}
					border="border"
				>
					E
				</LabelledButton>
				<LabelledButton
					label={"Filter"}
					border="border"
				>
					E
				</LabelledButton>
			</div>
			
		</div>
	);
}
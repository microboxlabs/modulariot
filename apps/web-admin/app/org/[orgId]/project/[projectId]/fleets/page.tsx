import { Fleets } from "@modulariot/ui/fleets/fleets";

export default function FleetsPage() {
	return (
		<div className="flex flex-col flex-grow h-full w-full">
			{
				/*
					<h1 className="text-2xl font-bold mb-4 mt-8 mx-8">Fleets</h1>       
				*/
			}
			<Fleets />
		</div>
	);
}
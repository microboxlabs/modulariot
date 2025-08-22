"use client";

import { useMemo, useState, useCallback } from "react";
import DeckGL, { FlyToInterpolator, type MapViewState } from "deck.gl";
import Map from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";


import { type VehicleData } from "../types/fleet.types";
import { PinLayer } from "./layers/pin_layer_clustered";

const mapboxStyles = {
	streets: "mapbox://styles/mapbox/streets-v9",
	satellite: "mapbox://styles/mapbox/satellite-streets-v11",
	dark: "mapbox://styles/mapbox/dark-v10",
	light: "mapbox://styles/mapbox/light-v10",
	outdoors: "mapbox://styles/mapbox/outdoors-v11",
};

// TODO: add a function that transforms geojson to latitude and longitude
function getCentroid(pts: VehicleData[]) {
	return { longitude: 0, latitude: 0 };

	/*
	if (!pts.length) return { longitude: 0, latitude: 0 };
	const longitude =
		pts.reduce((acc, p) => acc + p.longitude, 0) / Math.max(1, pts.length);
	const latitude =
		pts.reduce((acc, p) => acc + p.latitude, 0) / Math.max(1, pts.length);
	return { longitude, latitude };
	*/
}

export function MapView({
	data,
}: {
	data: VehicleData[];
}) {
    const [style, setStyle] = useState<keyof typeof mapboxStyles>("satellite");
    
	const centroid = useMemo(() => getCentroid(data), [data]);
	const [viewState, setViewState] = useState<MapViewState>({
		longitude: centroid.longitude,
		latitude: centroid.latitude,
		zoom: data.length <= 1 ? 12 : 4,
		pitch: 45,
		bearing: 45,
		transitionDuration: 500,
		transitionInterpolator: new FlyToInterpolator(),
	});

	const onViewStateChange = useCallback((e: any) => {
		setViewState(e.viewState);
	}, []);

    const layers = useMemo(() => {
        return [
            new PinLayer({
                data: data,
                zoom: viewState.zoom,
                updateTriggers: {
                    data,
                },
            })
        ]
    }, [data, viewState.zoom])

	return (
		<div className="w-full h-full">
			<DeckGL
				layers={layers}
				controller
				onViewStateChange={onViewStateChange}
				initialViewState={viewState}
				getCursor={({ isHovering, isDragging }) =>
					isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
				}
			>
				<Map
					mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
					mapStyle={mapboxStyles[style]}
					preserveDrawingBuffer
				/>
			</DeckGL>
		</div>
	);
} 
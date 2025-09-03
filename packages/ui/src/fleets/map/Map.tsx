"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import DeckGL, { FlyToInterpolator, type MapViewState, type PickingInfo } from "deck.gl";
import Map from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";


import { type VehicleData } from "../types/fleet.types";
import { PinLayer } from "./layers/pin_layer_clustered";
import MapStyleSelector from "./map-style-selector/map-style-selector";
import FloatingDataDisplay from "../../floating-data-display/floating-data-display";

const mapStyles = {
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
	setSelectedAssets
}: {
	data: VehicleData[];
	setSelectedAssets: (assets: VehicleData[]) => void;
}) {
  const [mapStyle, setMapStyle] = useState<keyof typeof mapStyles>("satellite");
  
	const centroid = useMemo(() => getCentroid(data), [data]);
	const [viewState, setViewState] = useState<MapViewState>({
		longitude: centroid.longitude,
		latitude: centroid.latitude,
		zoom: data.length <= 1 ? 12 : 4,
		pitch: 45,
		bearing: 45,
	});

	const onViewStateChange = useCallback((e: any) => {
		setViewState(e.viewState);
	}, []);

	const onPinClick = useCallback(({ object }: { object: any }) => {
		setViewState((prevViewState) => ({
				...prevViewState,
				longitude: object.geometry.coordinates[0],
				latitude: object.geometry.coordinates[1],
				transitionInterpolator: new FlyToInterpolator({ speed: 2 }),
				transitionDuration: 500,
				transitionEasing: (t: number) =>
          t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
			}));
		// Only show tooltip for non-clustered pins
		if (!object.properties.cluster) {
			setSelectedAssets([object.properties]);
		} else {
			setSelectedAssets([]);
		}
	}, [setSelectedAssets]);

    const layers = useMemo(() => {
        return [
            new PinLayer({
                data: data,
                zoom: viewState.zoom,
                updateTriggers: {
                    data,
                },
								onClick: onPinClick,
            })
        ]
    }, [data, viewState.zoom, onPinClick])

	return (
		<div  className="w-full h-full bg-slate-50 dark:bg-slate-800">
			<DeckGL
				layers={layers}
				controller
				onViewStateChange={onViewStateChange}
				viewState={viewState}
				getCursor={({ isHovering, isDragging }) =>
					isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
				}
			>
				<Map
					mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
					mapStyle={mapStyles[mapStyle]}
					preserveDrawingBuffer
				>
					<style>
						{`
							.mapboxgl-ctrl-logo {
								display: none !important;
							}
						`}
					</style>
				</Map>
			</DeckGL>
      <div className="absolute bottom-5 left-5 z-10 flex flex-col gap-2">
				<MapStyleSelector
					selectedStyle={mapStyle}
					setSelectedStyle={(style: string) => setMapStyle(style as keyof typeof mapStyles)}
				/>
			</div>
		</div>
	);
} 
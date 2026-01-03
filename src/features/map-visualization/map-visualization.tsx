import type { LayersList } from "@deck.gl/core";
import { useMemo } from "react";
import Map, { useControl, MapRef } from "react-map-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { DeckProps } from "@deck.gl/core";
import { Button, Spinner } from "flowbite-react";
import type { RefObject } from "react";
import MapTooltip from "../geographic-view/components/map-tooltip";
import CustomTable from "../common/components/custom-table/custom-table";
import content from "../shipping/components/content";

const mapStyles = {
  streets: "mapbox://styles/mapbox/streets-v9",
  satellite: "mapbox://styles/mapbox/satellite-streets-v11",
  dark: "mapbox://styles/mapbox/dark-v10",
  light: "mapbox://styles/mapbox/light-v10",
  outdoors: "mapbox://styles/mapbox/outdoors-v11",
  hybrid: "mapbox://styles/mapbox/hybrid-v10",
};

function DeckGLOverlay(props: DeckProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

export default function MapVisualization({
  mapStyle,
  layers,
  isLoading = false,
  mapRef,
  onZoomChange,
}: {
  mapStyle: keyof typeof mapStyles;
  layers: LayersList;
  isLoading?: boolean;
  mapRef: RefObject<MapRef | null>;
  onZoomChange?: (zoom: number) => void;
}) {
  const mapboxStyles = useMemo(
    () => (
      <style>
        {`
          .mapboxgl-ctrl-logo {
            display: none !important;
          }
          .mapboxgl-ctrl-attrib {
            position: absolute !important;
            bottom: 0 !important;
            right: 0 !important;
            margin: 0 !important;
            font-size: 12px !important;
            background: rgba(255, 255, 255, 0.5) !important;
            padding: 0 5px !important;
            border-radius: 2px 0 0 0 !important;
            z-index: 1000 !important;
            display: flex !important;
            flex-direction: row !important;
          }
          .mapboxgl-ctrl-attrib-inner {
            display: block !important;
          }
          .mapboxgl-ctrl-attrib a {
            color: #333 !important;
            text-decoration: none !important;
          }
          .mapboxgl-ctrl-attrib a:hover {
            text-decoration: underline !important;
          }
        `}
      </style>
    ),
    []
  );

  return (
    <div className="h-full w-full relative rounded-lg overflow-hidden">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
        mapStyle={mapStyles[mapStyle]}
        onLoad={(e) => onZoomChange?.(e.target.getZoom())}
        onZoom={(e) => onZoomChange?.(e.viewState.zoom)}
        initialViewState={{
          longitude: -62.136105, // South America longitude (centered)
          latitude: -21.756514, // South America latitude (centered)
          zoom: 2.5,
        }}
      >
        {isLoading && (
          <div className="absolute top-4 left-0 bg-gray-200 dark:bg-gray-800 p-2 rounded-r-full z-10">
            <Spinner />
          </div>
        )}
        <DeckGLOverlay layers={layers} />
      </Map>
      {mapboxStyles}
    </div>
  );
}

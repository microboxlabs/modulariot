import type {
  LayersList,
  MapViewState,
  ViewStateChangeParameters,
} from "@deck.gl/core";
import { useCallback, useState, useMemo } from "react";
import Map, { useControl } from "react-map-gl";
import DeckGL from "deck.gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { DeckProps } from "@deck.gl/core";

const mapStyles = {
  streets: "mapbox://styles/mapbox/streets-v9",
  satellite: "mapbox://styles/mapbox/satellite-streets-v11",
  dark: "mapbox://styles/mapbox/dark-v10",
  light: "mapbox://styles/mapbox/light-v10",
  outdoors: "mapbox://styles/mapbox/outdoors-v11",
  hybrid: "mapbox://styles/mapbox/hybrid-v10",
};

// Default viewState for Chile
const INITIAL_VIEW_STATE = {
  longitude: -71.543, // Santiago, Chile coordinates
  latitude: -33.459,
  zoom: 10,
  pitch: 0,
  bearing: 0,
};

function DeckGLOverlay(props: DeckProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

export default function MapVisualization({
  mapStyle,
  layers,
}: {
  mapStyle: keyof typeof mapStyles;
  layers: LayersList;
}) {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);

  const onViewStateChange = useCallback((e: ViewStateChangeParameters) => {
    setViewState(e.viewState);
  }, []);

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

  console.log("Rendering again the map");

  return (
    <div className="h-full w-full relative rounded-lg overflow-hidden">
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
        mapStyle={mapStyles[mapStyle]}
      >
        <DeckGLOverlay layers={layers} />
      </Map>
      {mapboxStyles}
    </div>
  );
}

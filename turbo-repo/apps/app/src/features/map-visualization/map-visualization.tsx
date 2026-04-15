import type { LayersList } from "@deck.gl/core";
import { useMemo, useState, useEffect, useRef } from "react";
import Map, { useControl, MapRef } from "react-map-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { DeckProps } from "@deck.gl/core";
import { Spinner } from "flowbite-react";
import type { RefObject } from "react";

const mapStyles = {
  streets: "mapbox://styles/mapbox/streets-v9",
  satellite: "mapbox://styles/mapbox/satellite-streets-v11",
  dark: "mapbox://styles/mapbox/dark-v10",
  light: "mapbox://styles/mapbox/light-v10",
  outdoors: "mapbox://styles/mapbox/outdoors-v11",
  hybrid: "mapbox://styles/mapbox/hybrid-v10",
};

function DeckGLOverlay(props: DeckProps) {
  const overlay = useControl<MapboxOverlay>(
    () =>
      new MapboxOverlay({
        ...props,
        parameters: {
          ...props.parameters,
        },
      })
  );
  overlay.setProps({
    ...props,
    parameters: {
      ...props.parameters,
    },
  });
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
  const [cursor, setCursor] = useState<string>("grab");
  const [isMapDragging, setIsMapDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize map when container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      // Trigger map resize after a small delay to ensure DOM has updated
      requestAnimationFrame(() => {
        mapRef.current?.resize();
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapRef]);

  const mapboxStyles = useMemo(
    () => (
      <style>
        {`
          .mapboxgl-ctrl-logo {
            display: none !important;
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
    <div
      ref={containerRef}
      className="h-full w-full relative rounded-lg overflow-hidden"
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
        mapStyle={mapStyles[mapStyle]}
        onLoad={(e) => onZoomChange?.(e.target.getZoom())}
        onZoom={(e) => onZoomChange?.(e.viewState.zoom)}
        onDragStart={() => setIsMapDragging(true)}
        onDragEnd={() => setIsMapDragging(false)}
        cursor={cursor}
        initialViewState={{
          longitude: -62.136105,
          latitude: -21.756514,
          zoom: 2.5,
        }}
        preserveDrawingBuffer={true}
        antialias={true}
      >
        {isLoading && (
          <div className="absolute top-4 left-0 bg-gray-200 dark:bg-gray-800 p-2 rounded-r-full z-10">
            <Spinner />
          </div>
        )}
        <DeckGLOverlay
          layers={layers}
          getCursor={({ isHovering }) => {
            let newCursor: string;
            if (isMapDragging) {
              newCursor = "grabbing";
            } else if (isHovering) {
              newCursor = "pointer";
            } else {
              newCursor = "grab";
            }
            setCursor(newCursor);
            return newCursor;
          }}
        />
      </Map>
      {mapboxStyles}
    </div>
  );
}

import MapVisualization from "../map-visualization/map-visualization";
import { HistoricSignal } from "./types/historic-signal.type";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import type { MapRef } from "react-map-gl";
import { PulsePinLayer } from "@/features/geographic-view/components/layers/pulse-range";
import { I18nRecord } from "../i18n/i18n.service.types";
import ToolBar from "../geographic-view/components/tool-bar/tool-bar";
import TimeRangeSelector from "../geographic-view/components/tool-bar/time-range-selector";
import SummaryTooltip from "./summary-tooltip";

export default function GeographicVisualization({
  data,
  isLoading,
  dict,
}: {
  data: HistoricSignal[] | undefined;
  isLoading: boolean;
  dict: I18nRecord;
}) {
  const urlParams = new URLSearchParams(window.location.search);
  const p_from = urlParams.get("start_date") || "";
  const p_to = urlParams.get("end_date") || "";

  const [zoomValue, setZoomValue] = useState<number>(10);
  const [renderizableData, setRenderizableData] = useState<any | null>(null);
  const [dateRanges, setDateRanges] = useState<
    { start: string; end: string }[]
  >([]);
  const [movementTimes, setMovementTimes] = useState<
    { start: string; end: string }[]
  >([]);
  const [layers, setLayers] = useState<any[]>([]);
  const [mapStyle, setMapStyle] = useState<string>("satellite");

  const [dateRangeDisplayed, setDateRangeDisplayed] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: p_from,
    endDate: p_to,
  });

  // ToolBar
  const [displayPosition, setDisplayPosition] = useState<number>(0);

  // Initialize displayPosition when data changes
  useEffect(() => {
    if (renderizableData?.features?.length > 0) {
      setDisplayPosition(renderizableData.features.length - 1);
    }
  }, [renderizableData?.features?.length]);

  const mapRef = useRef<MapRef>(null);

  // Getter function that always returns current zoom from the map ref
  const getZoom = useCallback(() => {
    return mapRef.current?.getZoom() ?? 10;
  }, []);

  // Update zoom state only when integer value changes
  const handleZoomChange = useCallback(() => {
    const currentZoom = getZoom();
    const currentZoomInt = Math.round(currentZoom);
    const currentStateZoomInt = Math.round(zoomValue);

    // Only update state if the integer zoom level has changed
    if (currentZoomInt !== currentStateZoomInt) {
      setZoomValue(currentZoom);
    }
  }, [getZoom, zoomValue]);

  useEffect(() => {
    const signalsData = Array.isArray(data) ? (data as HistoricSignal[]) : [];

    const fixed_data = {
      type: "FeatureCollection",
      features: signalsData.map((signal, index) => ({
        type: "Feature",
        id: index,
        geometry: {
          type: "Point",
          coordinates: [signal.longitude, signal.latitude],
        },
        properties: {
          id: index,
          icu_code: 0,
          asset_id: signal.assetid || 0,
          rotation: 0,
          speed: 10,
          timestamp: signal.timestamp,
        },
      })),
    };

    const dateRangesValue = (() => {
      const tripSegments: { start: string; end: string }[] = [];

      // Group signals by trip_id
      const tripGroups = new Map<string, HistoricSignal[]>();

      signalsData.forEach((signal: HistoricSignal) => {
        if (signal.tripid != null) {
          const tripId = signal.tripid.toString();
          if (!tripGroups.has(tripId)) {
            tripGroups.set(tripId, []);
          }
          tripGroups.get(tripId)!.push(signal);
        }
      });

      // For each trip group, get first and last timestamp
      tripGroups.forEach((signals, tripId) => {
        if (signals.length > 0) {
          // Sort signals by timestamp to ensure correct order
          signals.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          const firstSignal = signals[0];
          const lastSignal = signals[signals.length - 1];

          tripSegments.push({
            start: firstSignal.timestamp,
            end: lastSignal.timestamp,
          });
        }
      });

      return tripSegments;
    })();

    const movementSegments = (() => {
      const segments: { start: string; end: string }[] = [];
      let currentMovementStart: string | null = null;
      let lastMovementTimestamp: string | null = null;
      let previousSpeed = 0;

      signalsData.forEach((signal: HistoricSignal) => {
        const currentSpeed = signal.speed || 0;

        // Speed transition from 0 to >0 (start of movement)
        if (previousSpeed === 0 && currentSpeed > 0) {
          currentMovementStart = signal.timestamp;
          lastMovementTimestamp = signal.timestamp;
        }
        // Continue movement (speed > 0)
        else if (currentSpeed > 0 && currentMovementStart !== null) {
          lastMovementTimestamp = signal.timestamp;
        }
        // Speed transition from >0 to 0 (end of movement)
        else if (previousSpeed > 0 && currentSpeed === 0) {
          if (currentMovementStart !== null && lastMovementTimestamp !== null) {
            segments.push({
              start: currentMovementStart,
              end: lastMovementTimestamp,
            });
          }
          currentMovementStart = null;
          lastMovementTimestamp = null;
        }

        previousSpeed = currentSpeed;
      });

      // Close any remaining movement segment at the end
      if (currentMovementStart !== null && lastMovementTimestamp !== null) {
        segments.push({
          start: currentMovementStart,
          end: lastMovementTimestamp,
        });
      }

      return segments;
    })();

    setDateRanges(dateRangesValue);
    setMovementTimes(movementSegments);
    setRenderizableData(fixed_data);
  }, [data, isLoading]);

  useEffect(() => {
    if (!renderizableData) {
      setLayers([]);
      return;
    }

    const layers = isLoading
      ? []
      : [
          new PulsePinLayer({
            data: renderizableData,
            zoom: zoomValue,
            selectedPulse: [],
            displayRange: dateRangeDisplayed,
            pickable: true,
            onClick: (d: any) => {
              d.object.properties.icu_code = 1;
            },
            updateTriggers: {
              data: renderizableData,
              zoom: zoomValue,
              displayRange: dateRangeDisplayed,
            },
          }),
        ];

    setLayers(layers);
  }, [renderizableData, isLoading, displayPosition, dateRangeDisplayed]);

  // Separate effect to handle zoom changes without recreating layers
  useEffect(() => {
    if (layers.length > 0 && layers[0]) {
      // Update zoom in existing layer without recreating the entire layer array
      const updatedLayers = layers.map((layer) => {
        if (layer instanceof PulsePinLayer) {
          return layer.clone({
            zoom: zoomValue,
            updateTriggers: {
              ...layer.props.updateTriggers,
              zoom: zoomValue,
            },
          });
        }
        return layer;
      });
      setLayers(updatedLayers);
    }
  }, [zoomValue]);

  const onTimelineChange = useCallback((range: any) => {
    setDateRangeDisplayed({
      startDate: range.startDate,
      endDate: range.endDate,
    });
  }, []);

  // Memoize ToolBar to prevent unnecessary re-renders on zoom changes
  const memoizedToolBar = useMemo(
    () => (
      <ToolBar
        dictionary={dict}
        positions={renderizableData?.features ?? []}
        display_position={{
          displayPosition,
          setDisplayPosition,
        }}
        selected_style={{
          selectedStyle: mapStyle,
          setSelectedStyle: setMapStyle,
        }}
        allow_screenshot={false}
        defaultOpenTimeline={true}
        timelineComponent={
          <TimeRangeSelector
            onChange={onTimelineChange}
            timeMarks={dateRanges}
            movementTimes={movementTimes}
            dict={dict}
          />
        }
      />
    ),
    [
      dict,
      renderizableData?.features,
      displayPosition,
      mapStyle,
      dateRanges,
      onTimelineChange,
    ]
  );

  return (
    <div className="w-full h-full overflow-hidden relative">
      <SummaryTooltip
        dict={dict}
        data={data as HistoricSignal[]}
        dateRangeDisplayed={dateRangeDisplayed}
      />
      <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-none">
        {memoizedToolBar}
      </div>
      <MapVisualization
        mapStyle={
          mapStyle as
            | "satellite"
            | "streets"
            | "dark"
            | "light"
            | "outdoors"
            | "hybrid"
        }
        layers={layers}
        isLoading={isLoading}
        mapRef={mapRef}
        onZoomChange={handleZoomChange}
      />
    </div>
  );
}

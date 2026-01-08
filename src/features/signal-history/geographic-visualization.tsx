import MapVisualization from "../map-visualization/map-visualization";
import { HistoricSignal } from "./types/historic-signal.type";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import type { MapRef } from "react-map-gl";
import { PulsePinLayer } from "@/features/geographic-view/components/layers/pulse-range";
import { I18nRecord } from "../i18n/i18n.service.types";
import ToolBar from "../geographic-view/components/tool-bar/tool-bar";
import TimeRangeSelector from "../geographic-view/components/tool-bar/time-range-selector";
import SummaryTooltip from "./summary-tooltip";
import { Button } from "flowbite-react";
import { useSearchParams } from "next/navigation";
import { tr } from "../i18n/tr.service";
import { convertJSONToCSV } from "./utils/json-to-csv";
import { handleDownloadCsv } from "./utils/download-csv";
import CustomCard from "../symptoms/components/card/custom-card";

export default function GeographicVisualization({
  data,
  isLoading,
  dict,
}: {
  data: HistoricSignal[] | undefined;
  isLoading: boolean;
  dict: I18nRecord;
}) {
  const searchParams = useSearchParams();
  const p_from = searchParams.get("start_date") || "";
  const p_to = searchParams.get("end_date") || "";

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
        if (
          signal.tripid != null &&
          signal.tripid !== "" &&
          signal.tripid !== "null"
        ) {
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
    const layers = [
      new PulsePinLayer({
        data: data, // Use the data as it is when we reach 200
        selectedPulse: [],
        displayRange: {
          startDate: new Date(dateRangeDisplayed.startDate),
          endDate: new Date(dateRangeDisplayed.endDate),
        },
        getPosition: (d: any) => {
          return [d.longitude, d.latitude];
        },
        pickable: true,
        updateTriggers: {
          displayRange: {
            startDate: new Date(dateRangeDisplayed.startDate),
            endDate: new Date(dateRangeDisplayed.endDate),
          },
        },
      }),
    ];

    setLayers(layers);
  }, [data?.length, isLoading, displayPosition, dateRangeDisplayed]);

  useEffect(() => {
    // Here each time data gets updated, we will get the 2 farthest coordinates, and generate a zoom in screen
    // To have visualization between both of them
    if (!data || data.length === 0 || !mapRef.current) return;

    const coordinates = data.map((signal) => [
      signal.longitude,
      signal.latitude,
    ]);

    if (isLoading == false) {
      if (coordinates.length === 1 && coordinates[0].length === 2) {
        // If only one point, center on it with a reasonable zoom level
        mapRef.current.flyTo({
          center: [coordinates[0][0], coordinates[0][1]] as [number, number],
          zoom: 15,
          duration: 1000,
        });
      } else if (coordinates.length > 1) {
        // Calculate bounding box
        const lngs = coordinates.map((coord) => coord[0]);
        const lats = coordinates.map((coord) => coord[1]);

        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        // Fit map to bounds with padding
        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: 50,
            duration: 1000,
            maxZoom: 18,
          }
        );
      }
    }
  }, [data, isLoading]);

  const onTimelineChange = useCallback((range: any) => {
    setDateRangeDisplayed((prev) => {
      // Skip update if nothing changed
      if (
        prev.startDate === range.startDate &&
        prev.endDate === range.endDate
      ) {
        return prev;
      }
      return {
        startDate: range.startDate,
        endDate: range.endDate,
      };
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

  function handleDownload() {
    // Filter data to only include elements within the displayed date range
    const startTimestamp = new Date(dateRangeDisplayed.startDate).getTime();
    const endTimestamp = new Date(dateRangeDisplayed.endDate).getTime();

    const filteredData = (data ?? []).filter((signal) => {
      const signalTimestamp = new Date(signal.timestamp).getTime();
      return (
        signalTimestamp >= startTimestamp && signalTimestamp <= endTimestamp
      );
    });

    handleDownloadCsv(filteredData, dict, dateRangeDisplayed);
  }

  return (
    <div className="flex flex-col w-full h-full gap-2">
      <div className="w-full h-full overflow-hidden relative">
        <div className="absolute top-4 left-4 right-4 z-20 block sm:hidden">
          <Button className="w-full" onClick={handleDownload}>
            {tr("signal_historic.download_csv", dict)}
          </Button>
        </div>
        <div className={data && data.length > 0 ? "hidden sm:block" : "hidden"}>
          <SummaryTooltip
            dict={dict}
            data={data as HistoricSignal[]}
            dateRangeDisplayed={dateRangeDisplayed}
          />
        </div>

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
        />
      </div>
      <CustomCard className="p-4">
        <TimeRangeSelector
          onChange={onTimelineChange}
          timeMarks={dateRanges}
          movementTimes={movementTimes}
          dict={dict}
        />
      </CustomCard>
    </div>
  );
}

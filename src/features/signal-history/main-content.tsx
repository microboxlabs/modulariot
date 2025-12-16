import SideBar from "./sidebar";
import MapVisualization from "../map-visualization/map-visualization";
import { useHistoricSignals } from "../common/providers/client-api.provider";
import { ScatterplotLayer, ArcLayer } from "deck.gl";
import { HistoricSignal } from "./types/historic-signal.type";
import { parseWKBPoint } from "@/utils/map-conversion";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  HistoricTimeline,
  ResumedTimeline,
} from "./types/historic-signal.type";
import type { MapRef } from "react-map-gl";
import { PulsePinLayer } from "@/features/geographic-view/components/layers/pulse";
import { GeofencePinLayer } from "@/features/geographic-view/components/layers/single-pin";
import { I18nRecord } from "../i18n/i18n.service.types";
/*
const test_data: HistoricTrip[] = [
  {
    id: 0,
    trip_id: "1564890",
    route: "ANF - STG",
    departure: "2025-12-11 00:00",
    arrival: "2025-12-11 16:59",
    trip_origin_coordinates: "POINT(-70.3975, -23.6509)",
    trip_destination_coordinates: "POINT(-70.6693, -33.4489)",
  },
  {
    id: 1,
    trip_id: null,
    route: "ANF - STG",
    departure: null,
    arrival: null,
    from: undefined,
    to: undefined,
  },
  {
    id: 2,
    trip_id: "1564890",
    route: "RCG - CCP",
    departure: "2025-12-10 00:00",
    arrival: "2025-12-11 23:59",
    from: [-70.7394, -34.1708],
    to: [-73.0444, -36.8201],
  },
];
*/

export default function SignalsHistory({
  timelineData,
  dict,
}: {
  timelineData: HistoricTimeline[];
  dict: I18nRecord;
}) {
  const [pulseDates, setPulseDates] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const assetId = urlParams.get("license_plate") || "";
  const p_from = urlParams.get("start_date") || "";
  const p_to = urlParams.get("end_date") || "";

  const shouldFetch = pulseDates !== null;

  const { data, error, isLoading } = useHistoricSignals({
    assetId,
    p_from: pulseDates?.from || "",
    p_to: pulseDates?.to || "",
    enabled: shouldFetch,
  });

  const [layers, setLayers] = useState<any[]>([]);

  /*
    {
      trip_id?: string;

      trip_start?: string;
      trip_end?: string;

      trip_origin?: string;
      trip_origin_coordinates?: string;

      trip_destination?: string;
      trip_destination_coordinates?: string;

      timeline_elements: HistoricTimeline[];
    }
  */

  const timelineDataReduced: ResumedTimeline[] = useMemo(() => {
    if (!timelineData || timelineData.length === 0) return [];

    const initialGroups: ResumedTimeline[] = [];
    const tripGroups = new Map<string, ResumedTimeline>();

    // Create groups of timelineElements for each trip and later for each timestamp between border times and each trip
    timelineData.forEach((item, index) => {
      if (item.trip_id) {
        if (!initialGroups.some((group) => group.trip_id === item.trip_id)) {
          initialGroups.push({
            trip_id: item.trip_id,
            trip_start: item.trip_start,
            trip_end: item.trip_end,
            trip_origin: item.trip_origin,
            trip_origin_coordinates: item.trip_origin_coordinates,
            trip_destination: item.trip_destination,
            trip_destination_coordinates: item.trip_destination_coordinates,
            timeline_elements: [],
          });
        }
      }
    });

    initialGroups.forEach((item, index) => {
      if (
        item.trip_end &&
        new Date(p_to) > new Date(item.trip_end) &&
        index == 0
      ) {
        tripGroups.set("-" + tripGroups.size, {
          trip_id: "-" + initialGroups.length,
          trip_start: item.trip_end,
          trip_end: p_to,
          trip_origin: item.trip_origin,
          trip_origin_coordinates: item.trip_origin_coordinates,
          trip_destination: undefined,
          trip_destination_coordinates: undefined,
          timeline_elements: [],
        });
      }

      tripGroups.set("-" + tripGroups.size, {
        trip_id: item.trip_id,
        trip_start: item.trip_start || p_from,
        trip_end: item.trip_end || p_to,
        trip_origin: item.trip_origin,
        trip_origin_coordinates: item.trip_origin_coordinates,
        trip_destination: item.trip_destination,
        trip_destination_coordinates: item.trip_destination_coordinates,
        timeline_elements: [],
      });

      const next_element = initialGroups[index + 1];
      if (item.trip_start && new Date(p_from) < new Date(item.trip_start)) {
        tripGroups.set("-" + tripGroups.size, {
          trip_id: "-" + initialGroups.length,
          trip_start: next_element ? next_element.trip_end : p_from,
          trip_end: item.trip_start,
          trip_origin: next_element ? next_element.trip_destination : undefined,
          trip_origin_coordinates: next_element
            ? next_element.trip_destination_coordinates
            : undefined,
          trip_destination: next_element
            ? next_element.trip_destination
            : undefined,
          trip_destination_coordinates: next_element
            ? next_element.trip_destination_coordinates
            : undefined,
          timeline_elements: [],
        });
      }
    });

    timelineData.forEach((item) => {
      tripGroups.forEach((tripGroup, tripId) => {
        let shouldAddItem = false;

        // Check if trip_id matches
        if (item.trip_id === tripId) {
          shouldAddItem = true;
        } else {
          // Check if item time is between the start and end of the trip time
          const tripStart = tripGroup.trip_start;
          const tripEnd = tripGroup.trip_end;
          const itemStart = item.trip_start || item.start;
          const itemEnd = item.trip_end || item.end;

          if (tripStart && tripEnd && itemStart && itemEnd) {
            const tripStartDate = new Date(tripStart);
            const tripEndDate = new Date(tripEnd);
            const itemStartDate = new Date(itemStart);
            const itemEndDate = new Date(itemEnd);

            // Check for time overlap: item starts before trip ends AND item ends after trip starts
            if (itemStartDate < tripEndDate && itemEndDate > tripStartDate) {
              shouldAddItem = true;
            }
          }
        }

        // Add item if it meets the criteria and doesn't already exist
        if (shouldAddItem) {
          const alreadyExists = tripGroup.timeline_elements.some(
            (el) => el.id === item.id
          );
          if (!alreadyExists) {
            tripGroup.timeline_elements.push(item);
          }
        }
      });
    });

    return Array.from(tripGroups.values());
  }, [timelineData]);

  useEffect(() => {
    if (pulseDates == null) {
      // Only create layers if we have valid data
      if (!timelineDataReduced || timelineDataReduced.length === 0) {
        setLayers([]);
        return;
      }

      const hovered_item = timelineDataReduced.find(
        (item) =>
          item.trip_id !== undefined && item.trip_id.toString() === hoveredRoute
      );

      const route_data = generateRouteUsable({
        selectedRoute:
          hovered_item &&
          typeof hovered_item.trip_origin_coordinates === "string" &&
          typeof hovered_item.trip_destination_coordinates === "string"
            ? {
                from: hovered_item.trip_origin_coordinates,
                to: hovered_item.trip_destination_coordinates,
              }
            : null,
      });

      // Create a line layer for the selected trip route
      const newLayers = [
        new ArcLayer<ResumedTimeline>({
          id: "ArcLayer",
          data: timelineDataReduced.filter(
            (item) =>
              item.trip_origin_coordinates && item.trip_destination_coordinates
          ),
          getSourcePosition: (d: ResumedTimeline) => {
            const point = parsePoint(d.trip_origin_coordinates ?? "");
            return point ?? [0, 0];
          },
          getTargetPosition: (d: ResumedTimeline) => {
            const point = parsePoint(d.trip_destination_coordinates ?? "");
            return point ?? [0, 0];
          },
          getSourceColor: (d: ResumedTimeline) => {
            const opacity =
              hoveredRoute == null
                ? 255
                : d.trip_id && hoveredRoute == d.trip_id.toString()
                  ? 255
                  : 50;

            if (d.trip_id && d.trip_id[0] != "-") {
              return [59, 130, 246, opacity];
            } else {
              return [200, 200, 200, opacity];
            }
          },
          getTargetColor: (d: any) => {
            const opacity =
              hoveredRoute == null
                ? 255
                : hoveredRoute == d.trip_id.toString()
                  ? 255
                  : 50;

            if (d.trip_id && d.trip_id[0] != "-") {
              return [59, 130, 246, opacity];
            } else {
              return [200, 200, 200, opacity];
            }
          },
          getWidth: 5,
          pickable: true,
          getHeight: (d: any) => {
            if (d.trip_id.toString() === hoveredRoute) {
              return 1.0;
            }
            return 0.9;
          },
          transitions: {
            getHeight: {
              duration: 200,
              easing: (t: number) => t, // linear, or use easing functions
            },
          },
          parameters: {
            depthCompare: "always", // Replaces depthTest: false
            depthWriteEnabled: false, // Replaces depthMask: false
          },
          updateTriggers: {
            getSourcePosition: [timelineDataReduced],
            getTargetPosition: [timelineDataReduced],
            getSourceColor: [hoveredRoute, timelineDataReduced],
            getTargetColor: [hoveredRoute, timelineDataReduced],
            getHeight: [hoveredRoute],
          },
        }),
        new GeofencePinLayer({
          data: route_data,
          zoom: 1,
        }),
      ];

      setLayers(newLayers);
    } else if (pulseDates?.from && pulseDates?.to) {
      const signalsData = Array.isArray(data) ? (data as HistoricSignal[]) : [];

      const fixed_data = {
        type: "FeatureCollection",
        features: signalsData.map((signal, index) => ({
          type: "Feature",
          id: index,
          geometry: {
            type: "Point",
            coordinates: parseWKBPoint(signal.location),
          },
          properties: {
            id: index,
            icu_code: 0, // Use icu_code 1 for pink color
            asset_id: signal.asset_id || 0,
            rotation: 0,
            speed: 10, // Set speed > 0 so they show as moving vehicles
            timestamp: signal.timestamp || 0,
            origin: index == 0,
            end: index == signalsData.length - 1,
            location_type:
              index == 0 ? 1 : index == signalsData.length - 1 ? 2 : null,
          },
        })),
      };

      const route_data = generateRouteUsable({ selectedRoute });

      const newLayers = isLoading
        ? []
        : [
            new PulsePinLayer({
              data: fixed_data,
              zoom: 10,
              selectedPulse: [],
              displayPosition: signalsData.length,
              updateTriggers: {
                data: fixed_data,
              },
            }),
            new GeofencePinLayer({
              data: selectedRoute ? route_data : fixed_data,
              zoom: 1,
            }),
          ];

      setLayers(newLayers);
    }
  }, [pulseDates, data, isLoading, hoveredRoute, timelineDataReduced]);

  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    const hoveredTrip = timelineDataReduced.find((trip) => {
      return trip.trip_id === hoveredRoute;
    });

    if (
      hoveredTrip &&
      hoveredTrip.trip_origin_coordinates &&
      hoveredTrip.trip_destination_coordinates
    ) {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const origin = parsePoint(hoveredTrip.trip_origin_coordinates);
      const destination = parsePoint(hoveredTrip.trip_destination_coordinates);

      if (origin && destination) {
        const camera = map.cameraForBounds([origin, destination], {
          padding: 50,
          pitch: 45,
          bearing: 30,
        });

        if (camera) {
          map.flyTo({
            ...camera,
            duration: 2000,
            essential: true,
          });
        }
      }
    }
  }, [hoveredRoute]);

  return (
    <div className="flex flex-row gap-2 h-full overflow-hidden">
      <SideBar
        pulseDates={{
          pulseDates,
          setPulseDates,
        }}
        data={timelineDataReduced}
        hover={{
          hoveredRoute,
          setHoveredRoute,
        }}
        route={{
          selectedRoute,
          setSelectedRoute,
        }}
        dict={dict}
      />
      <MapVisualization
        mapStyle="satellite"
        layers={layers}
        isLoading={isLoading && pulseDates != null}
        mapRef={mapRef}
      />
    </div>
  );
}

const parsePoint = (pointStr: string): [number, number] | null => {
  if (!pointStr) return null;

  // Match POINT(lon lat) format with space separation
  let match = pointStr.match(/POINT\s*\(\s*([^\s]+)\s+([^\s)]+)\s*\)/i);

  if (!match) {
    // Try without POINT prefix - just (lon lat)
    match = pointStr.match(/\(\s*([^\s]+)\s+([^\s)]+)\s*\)/);
  }

  if (!match) {
    // Try space-separated values without parentheses
    match = pointStr.match(/([^\s]+)\s+([^\s]+)/);
  }

  if (match) {
    const lon = parseFloat(match[1].trim());
    const lat = parseFloat(match[2].trim());
    return [lon, lat];
  }

  return null;
};

function generateRouteUsable({
  selectedRoute,
}: {
  selectedRoute: { from: string; to: string } | null;
}) {
  return {
    type: "FeatureCollection",
    features: selectedRoute
      ? [
          {
            type: "Feature",
            id: 0,
            geometry: {
              type: "Point",
              coordinates: parsePoint(selectedRoute?.from),
            },
            properties: {
              id: 0,
              location_type: 1,
            },
          },
          {
            type: "Feature",
            id: 1,
            geometry: {
              type: "Point",
              coordinates: parsePoint(selectedRoute?.to),
            },
            properties: {
              id: 1,
              location_type: 2,
            },
          },
        ]
      : [],
  };
}

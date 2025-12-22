import { FaClock } from "react-icons/fa";
import CustomCard, {
  InformationBadge,
} from "@/features/common/components/custom-card/custom-card";
import { FaRoute } from "react-icons/fa";
import { useState } from "react";
import {
  HistoricTimeline,
  HistoricTrip,
  ResumedTimeline,
  RouteState,
} from "./types/historic-signal.type";
import FormattedDate from "../common/components/formatted-date";
import TimelineComponent from "../symptoms/components/map-view/timeline";
import { I18nRecord } from "../i18n/i18n.service.types";
import { ChevronLeft } from "flowbite-react-icons/outline";

export default function SideBar({
  pulseDates,
  data,
  hover: { hoveredRoute, setHoveredRoute },
  route,
  dict,
}: {
  pulseDates: {
    pulseDates: { from: string; to: string } | null;
    setPulseDates: (dates: { from: string; to: string } | null) => void;
  };
  data: ResumedTimeline[];
  hover: {
    hoveredRoute: string | null;
    setHoveredRoute: (route: string | null) => void;
  };
  route: RouteState;
  dict: I18nRecord;
}) {
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);

  if (selectedTrip !== null) {
  }

  return (
    <div className="flex flex-col rounded-lg p-2 bg-white dark:bg-gray-800 w-[600px] border border-gray-200 dark:border-gray-700">
      {selectedTrip !== null ? (
        <RouteTimeline
          data={data}
          pulseDates={pulseDates}
          route={route}
          selectedTrip={selectedTrip}
          setSelectedTrip={setSelectedTrip}
          dict={dict}
        />
      ) : (
        <TripSelector
          setSelectedTrip={setSelectedTrip}
          pulseDates={pulseDates}
          data={data}
          hover={{ setHoveredRoute }}
          route={route}
        />
      )}
    </div>
  );
}

function RouteTimeline({
  data,
  pulseDates,
  route,
  selectedTrip,
  setSelectedTrip,
  dict,
}: {
  data: ResumedTimeline[];
  pulseDates: {
    pulseDates: { from: string; to: string } | null;
    setPulseDates: (dates: { from: string; to: string } | null) => void;
  };
  route: RouteState;
  selectedTrip: number | null;
  setSelectedTrip: (index: number | null) => void;
  dict: I18nRecord;
}) {
  const selected_element = selectedTrip !== null ? data[selectedTrip] : null;
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div
        className="border border-gray-300 dark:border-gray-700 flex flex-row items-center justify-between gap-2 rounded-md transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer mb-4"
        onClick={() => {
          setSelectedTrip(null);
          pulseDates.setPulseDates(null);
          route.setSelectedRoute(null);
        }}
      >
        <div className="flex flex-row items-center gap-2 pl-2 py-1">
          <div
            className={` text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md  w-5 h-5 border-transparent bg-transparent`}
          >
            <ChevronLeft />
          </div>
          <div className="flex flex-col w-full justify-center align-middle">
            <h1 className="text-md font-bold text-gray-900 dark:text-white">
              {selected_element?.trip_id && selected_element.trip_id[0] !== "-"
                ? `Viaje ${selected_element.trip_id}`
                : "Tramo sin viaje"}
            </h1>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full overflow-y-auto">
        <TimelineComponent
          className="!p-0"
          dict={dict}
          treatmentData={{
            symptom_info: {
              id: 0,
              name: "",
              type: "",
              icu_code: 0,
              icu_condition: "",
            },
            timeline: selected_element?.timeline_elements
              ? selected_element.timeline_elements
                  .map((el) => {
                    if (el.name != "Trip") {
                      return {
                        start: el.start || el.trip_start || "",
                        end: el.end || el.trip_end || "",
                        conditions_agg: el.conditions_agg,
                        icu_codes: el.icu_codes || [],
                        icu_conditions: el.icu_conditions || [],
                        symptom_id: 1,
                        symptom_name: el.name || "",
                      };
                    }
                    return undefined;
                  })
                  .filter(
                    (el): el is NonNullable<typeof el> => el !== undefined
                  )
              : [],
            trip_info: {
              asset_id: "",
              carrier: "",
              destination: "",
              driver: "",
              origin: "",
              trip_id: "",
              type_load: "",
              driver_contact: "",
            },
            conditions_agg: [],
          }}
          setSelectedTreatment={() => {}}
          setSelectedTreatmentIndex={() => {}}
          order={"asc"}
        />
      </div>
    </div>
  );
}

function TripSelector({
  setSelectedTrip,
  pulseDates,
  data,
  hover: { setHoveredRoute },
  route,
}: {
  setSelectedTrip: (index: number) => void;
  pulseDates: {
    pulseDates: { from: string; to: string } | null;
    setPulseDates: (dates: { from: string; to: string } | null) => void;
  };
  data: ResumedTimeline[];
  hover: {
    setHoveredRoute: (route: string | null) => void;
  };
  route: RouteState;
}) {
  const urlParams = new URLSearchParams(window.location.search);
  const p_to = urlParams.get("end_date") || "";

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="border border-gray-300 dark:border-gray-700 flex flex-row items-center justify-between gap-2 rounded-md transition-all duration-200">
        <div className="flex flex-row items-center gap-2 pl-2 py-1">
          <div
            className={` text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md  w-5 h-5 border-transparent bg-transparent"}`}
          >
            <FaClock />
          </div>
          <div className="flex flex-col w-full justify-center align-middle">
            <h1 className="text-md font-bold text-gray-900 dark:text-white">
              Timeline
            </h1>
          </div>
        </div>
      </div>
      <div
        className="w-full h-fit flex flex-col gap-2 overflow-y-auto"
        onMouseLeave={() => setHoveredRoute(null)}
      >
        {data?.map((trip, index) => {
          let badges = [];

          if (trip.trip_origin && trip.trip_destination) {
            badges.push({
              text: trip.trip_origin + " - " + trip.trip_destination,
              color: "blue",
              icon: FaRoute,
            } as InformationBadge);
          }

          let link_trip_departure_date = null;
          let link_trip_arrival_date = null;

          const past_element = data[index - 1];
          const next_element = data[index + 1];

          if (
            !trip.trip_origin &&
            past_element &&
            past_element.trip_destination
          ) {
            link_trip_departure_date = past_element.trip_destination;
          }

          if (
            !trip.trip_destination &&
            next_element &&
            next_element.trip_origin
          ) {
            link_trip_arrival_date = next_element.trip_origin;
          }

          return (
            <div
              key={index}
              title={`Trip ID: ${trip.trip_id}`}
              className="flex flex-col items-center justify-center rounded-lg pt-1 px-1 pb-1 bg-transparent  border border-gray-200 dark:border-gray-700 hover:border-gray-700 dark:hover:border-gray-200 transition-colors duration-200 cursor-pointer"
              onMouseEnter={() => {
                setHoveredRoute((trip.trip_id ?? "-").toString());
              }}
              onClick={() => {
                setSelectedTrip(index);

                route.setSelectedRoute({
                  from: trip.trip_origin_coordinates,
                  to: trip.trip_destination_coordinates,
                });

                // Helper function to convert UTC date to Chilean timezone
                const toChileanTime = (dateStr: string) => {
                  if (!dateStr) return "";
                  const date = new Date(dateStr);
                  return date
                    .toLocaleString("sv-SE", {
                      timeZone: "America/Santiago",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                    .replace(" ", "T");
                };

                const now = new Date().toISOString();

                pulseDates.setPulseDates({
                  from: toChileanTime(
                    trip.trip_start || link_trip_departure_date || ""
                  ),
                  to: toChileanTime(
                    trip.trip_end || link_trip_arrival_date || now
                  ),
                });
              }}
            >
              <CustomCard
                title={
                  trip.trip_id && trip.trip_id[0] != "-"
                    ? `Viaje ${trip.trip_id}`
                    : "Tramo sin viaje"
                }
                subtitle={null}
                badges={badges}
                style={{
                  title: "text-lg dark:text-white",
                  subtitle: "text-sm",
                }}
              >
                <div className="flex flex-col gap-2 font-light text-sm dark:text-white">
                  <div className="flex flex-row items-center gap-2">
                    <FaClock />{" "}
                    <FormattedDate
                      date={trip.trip_start ?? link_trip_departure_date}
                    />{" "}
                    -
                    <FormattedDate
                      date={
                        trip.trip_end ??
                        link_trip_arrival_date ??
                        p_to ??
                        new Date().toISOString()
                      }
                    />
                  </div>
                </div>
              </CustomCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}

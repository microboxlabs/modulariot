import { type Option } from "./types/options.type";
import { type ActiveFilters } from "./types/active-filters.type";

import { useState, useEffect } from "react";
import { type VehicleData } from "../types/fleet.types";
import MapFilter from "./inner-filters/map-filter";
import Image from "next/image";
import { speed_filter_options, condition_filter_options, trip_filter_options } from "./inner-filters/filter_lists";
import PinIcon from "../../icons/pin-icon";

type Filter = {
  text: string;
  filter_value: string;
  code: string;
  icon: React.ReactNode;
  activated: boolean;
};

function set_filtered_positions(
  originalPositions: VehicleData[],
  activeFilters: ActiveFilters,
  setPositions: (positions: VehicleData[]) => void
) {
  const filtered_positions = originalPositions.filter((position) => {
    const matchesTripState =
      !activeFilters.tripStates.some((filter: Filter) => filter.activated) ||
      activeFilters.tripStates.some(
        (filter: Filter) =>
          filter.activated &&
          position.in_trip === (filter.filter_value === "true")
      );

    const matchesCondition =
      !activeFilters.conditions.some((filter: Filter) => filter.activated) ||
      activeFilters.conditions.some(
        (filter: Filter) =>
          filter.activated &&
          position.symptoms_condition === Number(filter.code)
      );

    const matchesSpeed =
      !activeFilters.speed.some((filter: Filter) => filter.activated) ||
      activeFilters.speed.some((filter: Filter) => {
        if (filter.code === "1") {
          return (
            filter.activated &&
            (position.speed_limit_condition === 1 ||
              position.speed_limit_condition === null ||
              position.speed_limit_condition === 0)
          );
        } else if (filter.code === "2") {
          return (
            filter.activated &&
            (position.speed_limit_condition === 2 ||
              position.speed_limit_condition === 3)
          );
        } else if (filter.code === "3") {
          return filter.activated && position.speed_limit_condition === 4;
        }
      });
    return matchesTripState && matchesCondition && matchesSpeed;
  });

  setPositions(filtered_positions);
}

/*
  Here we have Filter menus, they are defined by these data:

  {
    label: The label that will be shown when hovering the filter
    filter_id: The identifier in the ActiveFilters type so i can connect the filters with the active filters for data
    options: The options of inside the filter, these are brouhgt from ./inner-filters.tsx/filter_lists
    icon: React component that will be rendered as an icon OF THE TOGGLEABLE BUTTON TO OPEN THE FILTER
  },
*/

const filter_menus = [
  {
    label: "Conditions",
    filter_id: "conditions",
    options: condition_filter_options,
    icon: <Image
      height={24}
      width={24}
      alt="blue pin"
      className="w-7 h-7"
      src={"/icons/conditions/alerta-critica.svg"}
    />
  },
  {
    label: "Speed",
    filter_id: "speed",
    options: speed_filter_options,
    icon: <Image
      height={24}
      width={24}
      alt="blue pin"
      className="w-7 h-7"
      src={"/icons/pin/blue_pin.svg"}
    />
  },
  {
    label: "Trip States",
    filter_id: "tripStates",
    options: trip_filter_options,
    icon: <PinIcon />
  }
]



export default function Filters({
  originalPositions,
  setPositions,
}: {
  originalPositions: VehicleData[];
  setPositions: (positions: VehicleData[]) => void;
}) {
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    conditions: condition_filter_options,
    speed: speed_filter_options,
    tripStates: trip_filter_options
  });

  return (
    <div className="flex flex-col gap-2 absolute top-2 left-2 z-10">
      { filter_menus.map( (menu, index) => (
        <div key={index} className={`z-[${10 - index}]`}>
          <MapFilter
            main_filter={activeFilters}
            setMainFilter={(filters: Record<string, Option[]>) => setActiveFilters(filters as ActiveFilters)}
            onChange={() => {set_filtered_positions(originalPositions, activeFilters, setPositions);}}
            filter_id={menu.filter_id}
            label={menu.label}
            icon={menu.icon}
          />
        </div>
      )) }
    </div>
  );
}

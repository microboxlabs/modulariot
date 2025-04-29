import blue_pin from "@assets/pin/blue_pin.svg";
import red_pin from "@assets/pin/red_pin.svg";
import yellow_pin from "@assets/pin/yellow_pin.svg";

import FilterComponent, { Option } from "./filter-component";
import alerta_critica from "@assets/conditions/alerta-critica.svg";

import { IconType } from "react-icons";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import icu_codes from "@/features/symptoms/model/icu_condition.json";
import { MapPosition } from "@/features/geographic-view/types/map";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import PinIcon from "@/features/icons/pin-icon";
import { useState, useEffect } from "react";
import CustomTooltip from "@/features/common/components/custom-tooltip/custom-tooltip";

export default function Filters({
  dict,
  originalPositions,
  setPositions,
}: {
  dict: I18nRecord;
  originalPositions: MapPosition[];
  setPositions: (positions: MapPosition[]) => void;
}) {
  // Maintain a state for all active filters
  const [activeFilters, setActiveFilters] = useState<{
    conditions: Option[];
    speed: Option[];
    tripStates: Option[];
  }>({
    conditions: [],
    speed: [],
    tripStates: [],
  });

  useEffect(() => {
    if (
      activeFilters.conditions.length === 0 &&
      activeFilters.tripStates.length === 0 &&
      activeFilters.speed.length === 0
    ) {
      setPositions(originalPositions);
      return;
    }

    const filtered_positions = originalPositions.filter((position) => {
      const matchesCondition =
        activeFilters.conditions.length === 0 ||
        activeFilters.conditions.some(
          (filter) => position.symptoms_condition === Number(filter.code),
        );

      const matchesSpeed =
        activeFilters.speed.length === 0 ||
        activeFilters.speed.some((filter) => {
          if (filter.code === "1") {
            return (
              position.speed_limit_condition === "1" ||
              position.speed_limit_condition === null
            );
          } else if (filter.code === "2") {
            return (
              position.speed_limit_condition === "2" ||
              position.speed_limit_condition === "3"
            );
          } else if (filter.code === "3") {
            return position.speed_limit_condition === "4";
          }
        });

      const matchesTripState =
        activeFilters.tripStates.length === 0 ||
        activeFilters.tripStates.some(
          (filter) => position.in_trip === (filter.filter_value === "true"),
        );

      return matchesCondition && matchesTripState && matchesSpeed;
    });

    setPositions(filtered_positions);
  }, [activeFilters, originalPositions, setPositions]);

  const handle_filter_change = (
    updated_options: Option[],
    filterType: "conditions" | "tripStates" | "speed",
  ) => {
    setActiveFilters((prev) => ({
      ...prev,
      [filterType]: updated_options.filter((option) => option.activated),
    }));
  };

  return (
    <div className="flex flex-col gap-2 pl-5 pt-5">
      <div className="z-[9999]">
        <FilterComponent
          label={(dict.symptoms as I18nRecord).conditions as string}
          icon={alerta_critica.src as string}
          icon_size="w-8 h-8"
          options={[
            {
              text: "Codigo Negro",
              filter_value: "codigo_negro",
              code: icu_codes.code_black,
              icon: (
                <ConditionIcon
                  condition="code black"
                  size="w-fit h-fit hover:brightness-[0.75]"
                  dict={dict}
                  placement="bottom"
                />
              ),
              activated: false,
            },
            {
              text: "Alerta Critica",
              filter_value: "alerta_critica",
              code: icu_codes.critical_condition,
              icon: (
                <ConditionIcon
                  condition="critical condition"
                  size="w-fit h-fit hover:brightness-[0.75]"
                  dict={dict}
                  placement="bottom"
                />
              ),
              activated: false,
            },
            {
              text: "En Observacion",
              filter_value: "en_observacion",
              code: icu_codes.under_observation,
              icon: (
                <ConditionIcon
                  condition="under observation"
                  size="w-fit h-fit hover:brightness-[0.75]"
                  dict={dict}
                  placement="bottom"
                />
              ),
              activated: false,
            },
            {
              text: "Comprometida",
              filter_value: "comprometida",
              code: icu_codes.compromised_condition,
              icon: (
                <ConditionIcon
                  condition="compromised condition"
                  size="w-fit h-fit hover:brightness-[0.75]"
                  dict={dict}
                  placement="bottom"
                />
              ),
              activated: false,
            },
            {
              text: "En Tratamiento",
              filter_value: "en_tratamiento",
              code: icu_codes.under_treatment,
              icon: (
                <ConditionIcon
                  condition="treatment"
                  size="w-fit h-fit hover:brightness-[0.75]"
                  dict={dict}
                  placement="bottom"
                />
              ),
              activated: false,
            },
            {
              text: "Estable",
              filter_value: "estable",
              code: icu_codes.stable,
              icon: (
                <ConditionIcon
                  condition="stable"
                  size="w-fit h-fit hover:brightness-[0.75]"
                  dict={dict}
                  placement="bottom"
                />
              ),
              activated: false,
            },
          ]}
          onChange={(options) => handle_filter_change(options, "conditions")}
        />
      </div>
      <div className="z-[9998]">
        <FilterComponent
          label={(dict.symptoms as I18nRecord).markers as string}
          icon={blue_pin.src}
          icon_size="w-7 h-7"
          options={[
            {
              text: (dict.symptoms as I18nRecord).normal_speed as string,
              filter_value: "1",
              code: "1",
              icon: blue_pin.src,
              activated: false,
            },
            {
              text: (dict.symptoms as I18nRecord).high_speed as string,
              filter_value: "2",
              code: "2",
              icon: yellow_pin.src,
              activated: false,
            },
            {
              text: (dict.symptoms as I18nRecord).very_high_speed as string,
              filter_value: "3",
              code: "3",
              icon: red_pin.src,
              activated: false,
            },
          ]}
          onChange={(options) => handle_filter_change(options, "speed")}
        />
      </div>
      <div className="z-[9997]">
        <FilterComponent
          label={(dict.symptoms as I18nRecord).trip_states as string}
          icon={PinIcon as unknown as IconType}
          icon_size="w-10 h-10"
          options={[
            {
              text: "Con viaje",
              filter_value: "true",
              code: "1",
              icon: (
                <CustomTooltip
                  content={
                    <div className="z-50 px-2 py-1 text-sm text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-600 rounded-md whitespace-nowrap">
                      {(dict.symptoms as I18nRecord).with_trip as string}
                    </div>
                  }
                  placement="bottom"
                >
                  <div className="flex justify-center items-center w-full h-full bg-blue-600 rounded-full">
                    <PinIcon disabled_style_change={true} />
                  </div>
                </CustomTooltip>
              ),
              activated: false,
            },
            {
              text: "Sin viaje",
              filter_value: "false",
              code: "2",
              icon: (
                <CustomTooltip
                  content={
                    <div className="z-50 px-2 py-1 text-sm text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-600 rounded-md whitespace-nowrap">
                      {(dict.symptoms as I18nRecord).without_trip as string}
                    </div>
                  }
                  placement="bottom"
                >
                  <div className="flex justify-center items-center w-full h-full bg-red-600 rounded-full">
                    <PinIcon disabled_style_change={true} />
                  </div>
                </CustomTooltip>
              ),
              activated: false,
            },
          ]}
          onChange={(options) => handle_filter_change(options, "tripStates")}
        />
      </div>
    </div>
  );
}

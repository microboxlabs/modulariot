import blue_pin from "@assets/pin/blue_pin.svg";
import red_pin from "@assets/pin/red_pin.svg";
import yellow_pin from "@assets/pin/yellow_pin.svg";

import FilterComponent, { Option } from "./filter-component";
import alerta_critica from "@assets/conditions/alerta-critica.svg";
import iniciado from "@assets/finished_state/iniciado.svg";
import terminado from "@assets/finished_state/terminado.svg";

import a_tiempo from "@assets/time_states/a_tiempo.svg";
import con_retraso from "@assets/time_states/con_retraso.svg";
import mucho_retraso from "@assets/time_states/mucho_retraso.svg";
import time_icon from "@assets/time_states/time_icon.svg";

import { AiOutlineInfo } from "react-icons/ai";
import { IconType } from "react-icons";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import icu_codes from "@/features/symptoms/model/icu_condition.json";
import { MapPosition } from "@/features/geographic-view/types/map";
import ConditionIcon from "@/features/symptoms/components/condition-icon";

export default function Filters({
  dict,
  originalPositions,
  setPositions,
}: {
  dict: I18nRecord;
  originalPositions: MapPosition[];
  setPositions: (positions: MapPosition[]) => void;
}) {
  const handle_filter_change = (updated_options: Option[]) => {
    const active_codes = updated_options.filter((option) => option.activated);

    if (active_codes.length === 0) {
      setPositions(originalPositions);
      return;
    }

    const filtered_positions = originalPositions.filter((position) => {
      return active_codes.some((option) => {
        return position.symptoms_condition === Number(option.code);
      });
    });

    setPositions(filtered_positions);
  };

  return (
    <div className="absolute top-0 left-0 bottom-0">
      <div className="flex flex-col gap-2 pl-5 pt-5">
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
                  size="w-fit h-fit"
                  dict={dict}
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
                  size="w-fit h-fit"
                  dict={dict}
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
                  size="w-fit h-fit"
                  dict={dict}
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
                  size="w-fit h-fit"
                  dict={dict}
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
                  size="w-fit h-fit"
                  dict={dict}
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
                  size="w-fit h-fit"
                  dict={dict}
                />
              ),
              activated: false,
            },
          ]}
          onChange={handle_filter_change}
        />
        <FilterComponent
          label={(dict.symptoms as I18nRecord).markers as string}
          icon={blue_pin.src}
          icon_size="w-7 h-7"
          options={[
            {
              text: "normal",
              filter_value: "normal",
              code: "1",
              icon: blue_pin.src,
              activated: false,
            },
            {
              text: "grave",
              filter_value: "grave",
              code: "2",
              icon: yellow_pin.src,
              activated: false,
            },
            {
              text: "gravisimo",
              filter_value: "gravisimo",
              code: "3",
              icon: red_pin.src,
              activated: false,
            },
          ]}
        />
        <FilterComponent
          label={(dict.symptoms as I18nRecord).started_trips as string}
          icon={AiOutlineInfo as IconType}
          icon_size="w-5 h-5"
          options={[
            {
              text: "Iniciado",
              filter_value: "iniciado",
              code: "1",
              icon: iniciado.src,
              activated: false,
            },
            {
              text: "Terminado",
              filter_value: "terminado",
              code: "2",
              icon: terminado.src,
              activated: false,
            },
          ]}
        />
        <FilterComponent
          label={(dict.symptoms as I18nRecord).times as string}
          icon={time_icon.src as string}
          icon_size="w-10 h-10"
          options={[
            {
              text: "A tiempo",
              filter_value: "a_tiempo",
              code: "1",
              icon: a_tiempo.src,
              activated: false,
            },
            {
              text: "Con retraso",
              filter_value: "con_retraso",
              code: "2",
              icon: con_retraso.src,
              activated: false,
            },
            {
              text: "Con mucho retraso",
              filter_value: "con_mucho_retraso",
              code: "3",
              icon: mucho_retraso.src,
              activated: false,
            },
          ]}
        />
      </div>
    </div>
  );
}

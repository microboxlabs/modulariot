import blue_pin from "@assets/pin/blue_pin.svg";
import red_pin from "@assets/pin/red_pin.svg";
import yellow_pin from "@assets/pin/yellow_pin.svg";

import FilterComponent from "./filter-component";
import alerta_critica from "@assets/conditions/alerta-critica.svg";
import codigo_negro from "@assets/conditions/codigo-negro.svg";
import comprometida from "@assets/conditions/comprometida.svg";
import en_observacion from "@assets/conditions/en-observacion.svg";
import en_remision from "@assets/conditions/en-remision.svg";
import en_tratamiento from "@assets/conditions/en-tratamiento.svg";
import estable from "@assets/conditions/estable.svg";
import iniciado from "@assets/finished_state/iniciado.svg";
import terminado from "@assets/finished_state/terminado.svg";

import a_tiempo from "@assets/time_states/a_tiempo.svg";
import con_retraso from "@assets/time_states/con_retraso.svg";
import mucho_retraso from "@assets/time_states/mucho_retraso.svg";
import time_icon from "@assets/time_states/time_icon.svg";

import { AiOutlineInfo } from "react-icons/ai";
import { IconType } from "react-icons";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function Filters({ dict }: { dict: I18nRecord }) {
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
              icon: codigo_negro as string,
              activated: false,
            },
            {
              text: "Alerta Critica",
              filter_value: "alerta_critica",
              icon: alerta_critica as string,
              activated: false,
            },
            {
              text: "En Observacion",
              filter_value: "en_observacion",
              icon: en_observacion as string,
              activated: false,
            },
            {
              text: "En Remision",
              filter_value: "en_remision",
              icon: en_remision as string,
              activated: false,
            },
            {
              text: "Comprometida",
              filter_value: "comprometida",
              icon: comprometida as string,
              activated: false,
            },
            {
              text: "En Tratamiento",
              filter_value: "en_tratamiento",
              icon: en_tratamiento as string,
              activated: false,
            },
            {
              text: "Estable",
              filter_value: "estable",
              icon: estable as string,
              activated: false,
            },
          ]}
        />
        <FilterComponent
          label={(dict.symptoms as I18nRecord).markers as string}
          icon={blue_pin.src as string}
          icon_size="w-7 h-7"
          options={[
            {
              text: "normal",
              filter_value: "normal",
              icon: blue_pin as string,
              activated: false,
            },
            {
              text: "grave",
              filter_value: "grave",
              icon: yellow_pin as string,
              activated: false,
            },
            {
              text: "gravisimo",
              filter_value: "gravisimo",
              icon: red_pin as string,
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
              icon: iniciado as string,
              activated: false,
            },
            {
              text: "Terminado",
              filter_value: "terminado",
              icon: terminado as string,
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
              icon: a_tiempo as string,
              activated: false,
            },
            {
              text: "Con retraso",
              filter_value: "con_retraso",
              icon: con_retraso as string,
              activated: false,
            },
            {
              text: "Con mucho retraso",
              filter_value: "con_mucho_retraso",
              icon: mucho_retraso as string,
              activated: false,
            },
          ]}
        />
      </div>
    </div>
  );
}

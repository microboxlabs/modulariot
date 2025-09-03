import PinIcon from "../../../icons/pin-icon";
import CustomTooltip from "../../../custom-tooltip";
import Image from "next/image";
import { Tooltip } from "flowbite-react";
import { type Option } from "../types/options.type";
import ConditionIcon from "../../../symptoms/conditions/condition-icon";
import icu_codes from "../../../symptoms/components/model/icu_condition.json";

export const speed_filter_options = [
  {
    text: "normal speed",
    filter_value: "1",
    code: "1",
    icon: <Tooltip
      style="auto"
      content = "Normal Speed"
      placement="bottom"
    >
      <Image
        height={24}
        width={24}
        alt="blue pin"
        className="w-7 h-7"
        src={"/icons/pin/blue_pin.svg"}
      />
    </Tooltip>,
    activated: false,
  },
  {
    text: "high speed",
    filter_value: "2",
    code: "2",
    icon: <Tooltip
      style="auto"
      content = "High Speed"
      placement="bottom"
    >
      <Image
        height={24}
        width={24}
        alt="blue pin"
        className="w-7 h-7"
        src={"/icons/pin/yellow_pin.svg"}
      />
    </Tooltip>,
    activated: false,
  },
  {
    text: "very high speed",
    filter_value: "3",
    code: "3",
    icon: <Tooltip
      style="auto"
      content = "Very High Speed"
      placement="bottom"
    >
      <Image
        height={24}
        width={24}
        alt="blue pin"
        className="w-7 h-7"
        src={"/icons/pin/red_pin.svg"}
      />
    </Tooltip>,
    activated: false,
  },
]

export const condition_filter_options = [
  {
    text: "Codigo Negro",
    filter_value: "codigo_negro",
    code: icu_codes.code_black,
    icon: (
      <ConditionIcon
        condition="code black"
        size="w-fit h-fit hover:brightness-[0.75]"
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
      />
    ),
    activated: false,
  },
]

export const trip_filter_options: Option[] = [
  {
    text: "Con viaje",
    filter_value: "true",
    code: "1",
    icon: <CustomTooltip
        content = "with_trip"
      >
        <div className="flex justify-center items-center w-full h-full bg-blue-600 rounded-full">
          <PinIcon disabled_style_change={true} />
        </div>
      </CustomTooltip>,
    activated: false,
  },
  {
    text: "Sin viaje",
    filter_value: "false",
    code: "2",
    icon: <CustomTooltip
      content = "without_trip"
    >
      <div className="flex justify-center items-center w-full h-full bg-red-600 rounded-full">
        <PinIcon disabled_style_change={true} />
      </div>
    </CustomTooltip>,
    activated: false,
  },
]
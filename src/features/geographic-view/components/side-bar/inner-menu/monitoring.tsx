import { Label } from "flowbite-react";
import { HiTruck } from "react-icons/hi";
import { FaArrowsRotate } from "react-icons/fa6";
import { GiAtom } from "react-icons/gi";
import ExpandableButton from "../../../../symptoms/components/expandable-button";

const data = {
  sections: [
    {
      title: "Servicios",
      icon: <FaArrowsRotate />,
      items: [
        {
          key: "Viajes",
          value: 147,
        },
        {
          key: "Emergencias",
          value: 5,
        },
        {
          key: "En tránsito",
          value: 93,
        },
        {
          key: "En destino",
          value: 54,
        },
        {
          key: "Horas de monitoreo",
          value: 1176,
        },
        {
          key: "Distancia monitoreada (km)",
          value: 46410,
        },
      ],
    },
    {
      title: "Flotas",
      icon: <HiTruck />,
      items: [
        {
          key: "Activos monitoreados",
          value: 174,
        },
        {
          key: "Vehículos",
          value: 102,
        },
        {
          key: "Calidad de señal de vehículos (spm)",
          value: 17,
        },
        {
          key: "Retraso de señal de vehículos (seg)",
          value: 793,
        },
        {
          key: "Contenedores",
          value: 4,
        },
        {
          key: "Conductores",
          value: 68,
        },
      ],
    },
    {
      title: "Síntomas",
      icon: <GiAtom />,
      items: [
        {
          key: "Estable",
          value: 98,
        },
        {
          key: "En observación",
          value: 35,
        },
        {
          key: "Comprometido",
          value: 18,
        },
        {
          key: "Critico",
          value: 4,
        },
        {
          key: "Código negro",
          value: 2,
        },
      ],
    },
  ],
};

export default function Monitoring(_dict: any) {
  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg text-gray-900 dark:text-white">
        General
      </Label>
      {/* Glota total */}
      <div className="w-full flex flex-col gap-2">
        {data.sections.map((section: any) => (
          <ExpandableButton
            key={section.title}
            initial_state={true}
            icon={section.icon}
            title={section.title}
            description=""
          >
            <div className="w-full flex flex-col gap-1 text-xs font-normal text-gray-900">
              {section.items.map((item: any) => (
                <p className="text-gray-900 dark:text-white" key={item.key}>
                  {item.key}:{" "}
                  <span className="text-gray-500 dark:text-gray-400">
                    {item.value}
                  </span>
                </p>
              ))}
            </div>
          </ExpandableButton>
        ))}
      </div>
    </div>
  );
}

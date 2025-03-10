import React, { useEffect, useRef, useState } from "react";
import { Label } from "flowbite-react";
import { HiTruck } from "react-icons/hi";
import { FaArrowsRotate } from "react-icons/fa6";
import { GiAtom } from "react-icons/gi";
import ExpandableButton from "../../../../symptoms/components/expandable-button";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { MapPosition } from "@/features/geographic-view/types/map";
import icuConditions from "@/features/symptoms/model/icu_condition.json";
export default function Monitoring({
  dict,
  positions,
}: {
  dict: I18nRecord;
  positions: MapPosition[];
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const data = React.useMemo(
    () => ({
      sections: [
        {
          title: "Servicios",
          icon: <FaArrowsRotate />,
          items: [
            {
              key: "Viajes",
              value: positions.length > 0 ? positions.length : 0,
            },
            {
              key: "Emergencias",
              value:
                positions.length > 0
                  ? positions.filter(
                      (position) =>
                        position.symptoms &&
                        position.symptoms[0].icu_code ===
                          +icuConditions["code_black"],
                    ).length
                  : 0,
            },
            {
              key: "En tránsito",
              value:
                positions.length > 0
                  ? positions.filter(
                      (position) =>
                        position.engine_status === "On" && position.is_moving,
                    ).length
                  : 0,
            },
            {
              key: "En destino",
              value: 0,
            },
            {
              key: "Horas de monitoreo",
              value: 0,
            },
            {
              key: "Distancia monitoreada (km)",
              value: 0,
            },
          ],
        },
        {
          title: "Flotas",
          icon: <HiTruck />,
          items: [
            {
              key: "Activos monitoreados",
              value: positions.length > 0 ? positions.length : 0,
            },
            {
              key: "Vehículos",
              value: positions.length > 0 ? positions.length : 0,
            },
            {
              key: "Calidad de señal de vehículos (spm)",
              value: 0,
            },
            {
              key: "Retraso de señal de vehículos (seg)",
              value: 0,
            },
            {
              key: "Contenedores",
              value: 0,
            },
            {
              key: "Conductores",
              value: positions.length > 0 ? positions.length : 0,
            },
          ],
        },
        {
          title: "Síntomas",
          icon: <GiAtom />,
          items: [
            {
              key: "Estable",
              value:
                positions.length > 0
                  ? positions.filter(
                      (position) =>
                        position.symptoms &&
                        position.symptoms[0].icu_code ===
                          +icuConditions["stable"],
                    ).length
                  : 0,
            },
            {
              key: "En observación",
              value:
                positions.length > 0
                  ? positions.filter(
                      (position) =>
                        position.symptoms &&
                        position.symptoms[0].icu_code ===
                          +icuConditions["under_observation"],
                    ).length
                  : 0,
            },
            {
              key: "Comprometido",
              value:
                positions.length > 0
                  ? positions.filter(
                      (position) =>
                        position.symptoms &&
                        position.symptoms[0].icu_code ===
                          +icuConditions["compromised_condition"],
                    ).length
                  : 0,
            },
            {
              key: "Critico",
              value:
                positions.length > 0
                  ? positions.filter(
                      (position) =>
                        position.symptoms &&
                        position.symptoms[0].icu_code ===
                          +icuConditions["critical_condition"],
                    ).length
                  : 0,
            },
            {
              key: "Código negro",
              value:
                positions.length > 0
                  ? positions.filter(
                      (position) =>
                        position.symptoms &&
                        position.symptoms[0].icu_code ===
                          +icuConditions["code_black"],
                    ).length
                  : 0,
            },
          ],
        },
      ],
    }),
    [positions],
  ) || {
    sections: [
      {
        title: "Servicios",
        icon: <FaArrowsRotate />,
        items: [
          {
            key: "Viajes",
            value: 0,
          },
          {
            key: "Emergencias",
            value: 0,
          },
          {
            key: "En tránsito",
            value: 0,
          },
          {
            key: "En destino",
            value: 0,
          },
          {
            key: "Horas de monitoreo",
            value: 0,
          },
          {
            key: "Distancia monitoreada (km)",
            value: 0,
          },
        ],
      },
      {
        title: "Flotas",
        icon: <HiTruck />,
        items: [
          {
            key: "Activos monitoreados",
            value: 0,
          },
          {
            key: "Vehículos",
            value: 0,
          },
          {
            key: "Calidad de señal de vehículos (spm)",
            value: 0,
          },
          {
            key: "Retraso de señal de vehículos (seg)",
            value: 0,
          },
          {
            key: "Contenedores",
            value: 0,
          },
          {
            key: "Conductores",
            value: 0,
          },
        ],
      },
      {
        title: "Síntomas",
        icon: <GiAtom />,
        items: [
          {
            key: "Estable",
            value: 0,
          },
          {
            key: "En observación",
            value: 0,
          },
          {
            key: "Comprometido",
            value: 0,
          },
          {
            key: "Critico",
            value: 0,
          },
          {
            key: "Código negro",
            value: 0,
          },
        ],
      },
    ],
  };

  useEffect(() => {
    console.log(positions);
  }, [positions]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation();
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("wheel", handleWheel);
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("wheel", handleWheel);
      }
    };
  }, []);

  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg text-gray-900 dark:text-white">
        General
      </Label>
      {/* Glota total */}
      <div
        ref={scrollContainerRef}
        className="z-50 w-full h-full overflow-y-auto flex flex-col gap-2"
      >
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

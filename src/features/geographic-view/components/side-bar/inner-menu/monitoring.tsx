import React, { useEffect, useRef } from "react";
import { Label } from "flowbite-react";
import { HiTruck } from "react-icons/hi";
import { FaArrowsRotate } from "react-icons/fa6";
import { GiAtom } from "react-icons/gi";
import ExpandableButton from "../../../../symptoms/components/expandable-button";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { MapPositionResume } from "@/features/geographic-view/types/map";
import Image from "next/image";
import street from "@assets/map_selection/street.png";
import satellite from "@assets/map_selection/satelital.png";

const style_buttons = [
  {
    img: street,
    text: "Calles",
    value: "streets",
  },
  {
    img: satellite,
    text: "Satelital",
    value: "satellite",
  },
];

export default function Monitoring({
  dict,
  mapPositionsResume,
  mapStyle,
  setMapStyle,
}: {
  dict: I18nRecord;
  mapPositionsResume: MapPositionResume;
  mapStyle: string;
  setMapStyle: (mapStyle: string) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const data = React.useMemo(
    () => ({
      sections: [
        {
          title: (dict.symptoms as I18nRecord).services as string,
          icon: <FaArrowsRotate />,
          items: [
            {
              key: (dict.symptoms as I18nRecord).trips as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[0]?.items?.[0]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).emergencies as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[0]?.items?.[1]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).in_transit as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[0]?.items?.[2]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).in_destination as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[0]?.items?.[3]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).monitoring_hours as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[0]?.items?.[4]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).monitored_distance as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[0]?.items?.[5]?.value
                : 0,
            },
          ],
        },
        {
          title: (dict.symptoms as I18nRecord).flotas as string,
          icon: <HiTruck />,
          items: [
            {
              key: (dict.symptoms as I18nRecord).active_monitored as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[0]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).vehicles as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[1]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord)
                .vehicle_signal_quality as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[2]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).vehicle_signal_delay as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[3]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).containers as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[4]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).drivers as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[5]?.value
                : 0,
            },
          ],
        },
        {
          title: (dict.symptoms as I18nRecord).symptoms as string,
          icon: <GiAtom />,
          items: [
            {
              key: (dict.symptoms as I18nRecord).stable as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[0]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).in_observation as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[1]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).compromised as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[2]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).critical as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[3]?.value
                : 0,
            },
            {
              key: (dict.symptoms as I18nRecord).black_code as string,
              value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[4]?.value
                : 0,
            },
          ],
        },
      ],
    }),
    [mapPositionsResume, dict],
  );

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
        Vista Mapa
      </Label>
      <div>
        <div className="w-full flex flex-row gap-2">
          {
            style_buttons.map((button) => (
              <div
                className={`flex flex-col gap-2 text-gray-900 dark:text-white justify-center items-center border rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${mapStyle === button.value ? "border-gray-900 dark:border-white" : "border-gray-300 dark:border-gray-700"}`}
                onClick={() => setMapStyle(button.value)}
              >
                <Image src={button.img} alt="Map View" width={100} height={100} />
              <p>{button.text}</p>
            </div>
          ))}
        </div>
      </div>

      <Label className="w-full flex text-left text-lg text-gray-900 dark:text-white">
        {(dict.symptoms as I18nRecord).general as string}
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
                <p
                  className="text-gray-900 dark:text-white first-letter:capitalize"
                  key={item.key}
                >
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

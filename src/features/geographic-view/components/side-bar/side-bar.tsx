import React, { useEffect, useState } from "react";
import MapButton from "../map-button";
import { HiChevronLeft } from "react-icons/hi";
import { Button, ButtonGroup } from "flowbite-react";
import Monitoring from "./inner-menu/monitoring";
import Download from "./inner-menu/download";
import Symptoms from "./inner-menu/symptoms";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  MapPositionResume,
  MapPosition,
} from "@/features/geographic-view/types/map";
export default function SideBar({
  dict,
  mapPositionsResume,
  mapPositions,
}: {
  dict: I18nRecord;
  mapPositionsResume: MapPositionResume;
  mapPositions: MapPosition[];
}) {
  const inner_menu = React.useMemo(
    () => [
      {
        button_text: (dict.symptoms as I18nRecord).monitoring as string,
        component: mapPositionsResume && (
          <Monitoring dict={dict} mapPositionsResume={mapPositionsResume} />
        ),
      },
      {
        button_text: (dict.symptoms as I18nRecord).symptoms as string,
        component: <Symptoms dict={dict} />,
      },
      {
        button_text: (dict.symptoms as I18nRecord).download as string,
        component: <Download dict={dict} mapPositions={mapPositions} />,
      },
    ],
    [dict, mapPositionsResume]
  );

  const [open, set_open] = useState(false);
  const [openned_menu, set_openned_menu] = useState(0);
  const [component, set_component] = useState(
    inner_menu[openned_menu].component
  );

  useEffect(() => {
    set_component(inner_menu[openned_menu].component);
  }, [openned_menu]);

  return (
    <div className=" h-full gap-[14px] flex flex-col z-50">
      <div className="h-full flex justify-end">
        <MapButton
          main_color="m-5 bg-white dark:bg-gray-800"
          button_color="bg-white dark:bg-gray-800"
          icon={HiChevronLeft}
          text={open ? "Close" : "Open"}
          open_to_left={true}
          onClick={() => set_open(!open)}
          activated={open}
        />
        <div
          className={`z-50 bg-white dark:bg-gray-800 flex flex-column overflow-hidden justify-center transition-all duration-500 ease-in-out ${open ? "w-[400px]" : "w-0"} h-100%`}
        >
          <div
            className={`w-full flex flex-col gap-3 items-center p-4 transition-all duration-500 ease-in-out ${open ? "opacity-100" : "opacity-0"}`}
          >
            <ButtonGroup>
              {inner_menu.map((menu, i) => (
                <Button
                  className="z-10"
                  onClick={() => set_openned_menu(i)}
                  key={i}
                  color={i == openned_menu ? "blue" : "gray"}
                >
                  {menu.button_text}
                </Button>
              ))}
            </ButtonGroup>
            <div className="flex flex-grow  w-full justify-center overflow-y-auto">
              {component}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

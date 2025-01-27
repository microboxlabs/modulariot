import { useState } from "react";
import MapButton from "../map-button";
import { HiChevronLeft } from "react-icons/hi";
import { Button } from "flowbite-react";
import Symptoms from "./inner-menu/symptoms";
import Monitoring from "./inner-menu/monitoring";
import Download from "./inner-menu/download";

const inner_menu = [
  {
    button_text: "Monitoring",
    component: Monitoring,
  },
  {
    button_text: "Symptoms",
    component: Symptoms,
  },
  {
    button_text: "Download",
    component: Download,
  },
];

export default function SideBar() {
  const [open, set_open] = useState(false);
  const [openned_menu, set_openned_menu] = useState(0);

  return (
    <div className="flex justify-end w-1/2">
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
        className={`flex flex-column overflow-hidden justify-center transition-all duration-300 ease-in-out ${open ? "w-2/4" : "w-0"} h-100% bg-white `}
      >
        <div
          className={`m-4 transition-all duration-500 ease-in-out ${open ? "opacity-100" : "opacity-0"}`}
        >
          <Button.Group>
            {inner_menu.map((menu, i) => (
              <Button
                onClick={() => set_openned_menu(i)}
                key={i}
                color={i == openned_menu ? "blue" : "gray"}
              >
                {menu.button_text}
              </Button>
            ))}
          </Button.Group>
          <div className="flex h-full w-full justify-center mt-6">
            {inner_menu[openned_menu].component()}
          </div>
        </div>
      </div>
    </div>
  );
}

import { Card, Tooltip } from "flowbite-react";
import MapVisualization from "../map-visualization/map-visualization";
import { ScatterplotLayer } from "@deck.gl/layers";
import TagManager from "../symptoms/components/tag-manager";
import { FaHistory, FaClock } from "react-icons/fa";
import { TbSortAscendingShapes } from "react-icons/tb";
import CustomCard from "../symptoms/components/card/custom-card";
import { ChevronLeft } from "flowbite-react-icons/outline";
import SideBar from "./sidebar";

const test_data = [
  {
    position: [-70.64827, -33.45694],
  },
  {
    position: [-70.6508, -33.455],
  },
  {
    position: [-70.645, -33.457],
  },
];

const tags = [
  {
    text: "Ejemplo",
  },
];

export default function MapHistoryView({
  dict,
  messages,
  onBackClick,
}: {
  dict: any;
  messages: any;
  onBackClick?: () => void;
}) {
  const layers = [
    new ScatterplotLayer({
      id: "test-positions",
      data: test_data,
      getPosition: (d: any) => d.position,
      getRadius: 50,
      getFillColor: [255, 0, 0, 180], // Red color
      pickable: true,
      radiusMinPixels: 3,
      radiusMaxPixels: 30,
    }),
  ];

  console.log("Rendering again the container");

  return (
    <div className="w-full h-full relative flex flex-col p-2 gap-2">
      <div className={`relative flex flex-col gap-10 rounded-lg`}>
        <CustomCard className="flex flex-row p-0 overflow-hidden">
          <div className="flex flex-row items-center w-full">
            <div
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
              onClick={() => {
                // Trigger rerender in parent and go back
                if (onBackClick) {
                  onBackClick();
                }
                window.history.back();
              }}
            >
              <ChevronLeft className="w-7 h-7 p-0 dark:text-gray-400" />
            </div>
            <div className="w-px h-full rounded-full bg-gray-100 dark:bg-gray-500 mr-4"></div>
            <h1
              className={`flex flex-row gap-1 text-lg font-bold tracking-tight whitespace-nowrap ${"text-gray-900 dark:text-white"}`}
            >
              Señales Historicas
            </h1>
            <div className="flex align-middle mx-2 gap-1">
              <TagManager
                tag_style="bg-transparent border-gray-300 dark:border-gray-500 dark:text-white"
                tags={tags}
              />
            </div>
          </div>
        </CustomCard>
      </div>
      <div className="flex flex-row gap-2 h-full">
        <SideBar />
        <MapVisualization mapStyle="satellite" layers={layers} />
      </div>
    </div>
  );
}

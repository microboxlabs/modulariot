import { Tooltip } from "flowbite-react";
import { FaClock } from "react-icons/fa";
import { TbSortAscendingShapes } from "react-icons/tb";
import CustomCard from "../symptoms/components/card/custom-card";

export default function SideBar() {
  return (
    <CustomCard className="w-[35%] h-full p-1!">
      <div className="w-full h-full">
        <div className="border border-gray-300 dark:border-gray-700 flex flex-row items-center justify-between gap-2 rounded-md transition-all duration-200">
          <div className="flex flex-row items-center gap-2 pl-2 py-1">
            <div
              className={` text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md  w-5 h-5 border-transparent bg-transparent"}`}
            >
              <FaClock />
            </div>
            <div className="flex flex-col w-full justify-center align-middle">
              <h1 className="text-md font-bold text-gray-900 dark:text-white">
                Timeline
              </h1>
            </div>
          </div>
          <Tooltip content={"Ascendente / Descendente"}>
            <div
              className="h-6 w-6 p-1 mr-1 hover:bg-gray-100 hover:cursor-pointer dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md"
              onClick={() => {}}
            >
              <TbSortAscendingShapes
                className={`h-5 w-5 transition-all duration-200`}
              />
            </div>
          </Tooltip>
        </div>
      </div>
    </CustomCard>
  );
}

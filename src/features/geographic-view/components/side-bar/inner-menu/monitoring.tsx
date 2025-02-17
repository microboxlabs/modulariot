import { Label } from "flowbite-react";
import CustomDropdown from "./components/custom_dropdown";
import { HiTruck } from "react-icons/hi";
import { FaArrowsRotate } from "react-icons/fa6";
import { GiAtom } from "react-icons/gi";
import ExpandableButton from '../../../../symptoms/components/expandable-button';

export default function Monitoring({ dict }: { dict: any }) {
  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg text-gray-900 dark:text-white">General</Label>
      {/* Glota total */}
      <div className="w-full flex flex-col gap-2">
        <ExpandableButton
          initial_state={true}
          icon={<HiTruck />}
          title={dict.symptoms.total_fleet}
          description=""
        >
          <div className="w-full flex flex-col gap-1 text-xs font-normal text-gray-900">
            <p className="text-gray-900 dark:text-white">
              {dict.symptoms.trips}: <span className="text-gray-500 dark:text-gray-400">96</span>
            </p>
            <p className="text-gray-900 dark:text-white">
              {dict.symptoms.plates}: <span className="text-gray-500 dark:text-gray-400">96</span>
            </p>
            <p className="text-red-600 dark:text-red-400">
              {dict.symptoms.incidents}: 245
            </p>
            <p className="text-gray-900 dark:text-white">
              {dict.symptoms.processed_distance}: <span className="text-gray-500 dark:text-gray-400  ">89.055</span>
            </p>
            <p className="text-gray-900 dark:text-white">
              {dict.symptoms.average_duration_in_km}: <span className="text-gray-500 dark:text-gray-400">11:51:07 hrs</span>
            </p>
          </div>
        </ExpandableButton>
      </div>
      {/* Señales */}
      <div className="w-full flex flex-col gap-2">
        <ExpandableButton
          initial_state={true}
          icon={<FaArrowsRotate />}
          title={dict.symptoms.signals}
          description=""
        >
          <div className="w-full flex flex-col gap-1 text-xs font-normal text-gray-900">
            <p className="text-gray-900 dark:text-white">
              {dict.symptoms.movement_per_minute}: <span className="text-gray-500 dark:text-gray-400 ">5.1</span>
            </p>
            <p className="text-gray-900 dark:text-white">
              {dict.symptoms.delay}: <span className="text-gray-500 dark:text-gray-400">00:02:21</span>
            </p>
          </div>
        </ExpandableButton>
      </div>
      {/* Síntomas <- Contaminacion total */}
      <div className="w-full flex flex-col gap-2">
        <ExpandableButton
          initial_state={true}
          icon={<GiAtom />}
          title={dict.symptoms.symptoms}
          description=""
        >
          <div className="w-full flex flex-col gap-1 text-xs font-normal text-gray-900">
            <p className="text-gray-900 dark:text-white">
              {dict.symptoms.total_co2}: <span className="text-gray-500 dark:text-gray-400">91.155</span>
            </p>
            <p className="text-gray-900 dark:text-white">
              {dict.symptoms.methane}: <span className="text-gray-500 dark:text-gray-400">17</span>
            </p>
            <p className="text-gray-900 dark:text-white">
              {dict.symptoms.nitrous_oxide}: <span className="text-gray-500 dark:text-gray-400">1.034</span>
            </p>
            <p className="text-gray-900 dark:text-white"  >
              {dict.symptoms.tank_to_tank}: <span className="text-gray-500 dark:text-gray-400">15.978</span>
            </p>
          </div>
        </ExpandableButton>
      </div>
    </div>
  );
}

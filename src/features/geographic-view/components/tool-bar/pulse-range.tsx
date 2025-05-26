import { useState } from "react";
import { MapPosition } from "../../types/map";
import { ViewStateType } from "../map-visualization-trip";
import { HiChevronUp } from "react-icons/hi";

type PulseRangeProps = {
  positions: MapPosition[];
  displayPosition: number;
  setDisplayPosition: (position: number) => void;
  zoom_on_pin: (
    longitude: number,
    latitude: number,
    clustered: boolean,
    setViewState: (viewState: ViewStateType) => void,
    viewState: ViewStateType,
    zoom?: number,
  ) => void;
  setViewState: (viewState: ViewStateType) => void;
  viewState: ViewStateType;
};

export default function PulseRange({
  positions,
  displayPosition,
  setDisplayPosition,
  zoom_on_pin,
  setViewState,
  viewState,
}: PulseRangeProps) {
  const [showChart, setShowChart] = useState<boolean>(false);

  return (
    <div className="w-full h-full flex flex-col">
      <div
        className={`w-full h-56 flex flex-row justify-center items-center gap-2 ${showChart ? "max-h-56" : "max-h-0"} transition-all duration-300 overflow-hidden`}
      ></div>
      <div className="w-full h-full flex flex-row justify-center items-center gap-2">
        <input
          type="range"
          min={0}
          max={positions?.length ?? 0}
          value={displayPosition}
          onChange={(e) => {
            if (positions) {
              zoom_on_pin(
                positions[Number(e.target.value)]?.longitude ?? 0,
                positions[Number(e.target.value)]?.latitude ?? 0,
                false,
                setViewState,
                viewState,
                10,
              );
            }
            setDisplayPosition(Number(e.target.value));
          }}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div
          className="flex justify-center items-center cursor-pointer"
          onClick={() => setShowChart(!showChart)}
        >
          <HiChevronUp
            className={`text-gray-900 dark:text-gray-500 w-5 h-5 transition-transform ease-in-out duration-300 ${showChart ? "rotate-180" : ""}`}
          />
        </div>
      </div>
    </div>
  );
}

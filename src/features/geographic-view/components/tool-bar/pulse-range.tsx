// import { useState, memo, useRef, useEffect } from "react";
import { MapPosition } from "../../types/map";
import { ViewStateType } from "../map-visualization-trip";
// import { HiChevronUp } from "react-icons/hi";
// import ReactEcharts from "echarts-for-react";

type PulseRangeProps = {
  positions: MapPosition[];
  displayPosition: number;
  setDisplayPosition: (position: number) => void;
  onZoom: (e: any) => void;
};

function PulseRangeComponent({
  positions,
  displayPosition,
  setDisplayPosition,
  onZoom,
}: PulseRangeProps) {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="w-full h-full flex flex-row justify-center items-center gap-2">
        <input
          type="range"
          min={0}
          max={positions?.length ?? 0}
          value={displayPosition}
          onChange={(e) => {
            if (positions) {
              onZoom(e);
            }
            setDisplayPosition(Number(e.target.value));
          }}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}

export default PulseRangeComponent;

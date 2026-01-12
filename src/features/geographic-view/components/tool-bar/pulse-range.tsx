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
      <style>{`
        .range-slider {
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .range-slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: rgb(59 130 246);
          border: 2px solid white;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .range-slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: rgb(59 130 246);
          border: 2px solid white;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
      `}</style>
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
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-slider"
          style={{
            background: `linear-gradient(to right, rgb(37 99 235) 0%, rgb(37 99 235) ${
              (displayPosition / (positions?.length ?? 1)) * 100
            }%, rgb(229 231 235) ${
              (displayPosition / (positions?.length ?? 1)) * 100
            }%, rgb(229 231 235) 100%)`,
          }}
        />
      </div>
    </div>
  );
}

export default PulseRangeComponent;

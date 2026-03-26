import { MapPosition } from "../../types/map";

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
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
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

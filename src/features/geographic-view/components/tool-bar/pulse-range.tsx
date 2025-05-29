import { useState, memo, useRef, useEffect } from "react";
import { MapPosition } from "../../types/map";
import { ViewStateType } from "../map-visualization-trip";
import { HiChevronUp } from "react-icons/hi";
import ReactEcharts from "echarts-for-react";

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
    camera_movement: boolean,
    zoom?: number,
  ) => void;
  setViewState: (viewState: ViewStateType) => void;
  viewState: ViewStateType;
  camera_movement: boolean;
};

function PulseRangeComponent({
  positions,
  displayPosition,
  setDisplayPosition,
  zoom_on_pin,
  setViewState,
  viewState,
  camera_movement,
}: PulseRangeProps) {
  /*
  const [showChart, setShowChart] = useState<boolean>(false);
  const chartRef = useRef<any>();

  const data = positions.map((position) => {
    return {
      hour: position.timestamp,
      speed: position.speed,
    };
  });

  const options = {
    tooltip: {
      trigger: "axis",
      confine: true,
      position(point: number[], params: any, dom: any, rect: any, size: any) {
        const [x, y] = point;
        const viewHeight = size.viewSize[1];
        const tooltipHeight = size.contentSize[1];

        if (y > viewHeight / 2) {
          return [x, y - tooltipHeight - 10];
        }
        return [x, y + 10];
      },
      formatter(params: any) {
        const data = params[0];
        return `Time: ${new Date(data.value[0]).toLocaleTimeString()}<br/>Speed: ${data.value[1]} km/h`;
      },
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      borderColor: "#ccc",
      borderWidth: 1,
      textStyle: {
        color: "#333",
      },
      padding: [5, 10],
    },
    grid: {
      top: 20,
      right: 20,
      bottom: 70,
      left: 20,
      containLabel: true,
    },
    xAxis: {
      type: "time",
      name: "Hour",
      nameLocation: "middle",
      nameGap: 30,
      boundaryGap: false,
      axisLabel: {
        formatter: (value: number) => {
          return new Date(value).toLocaleTimeString();
        },
      },
    },
    yAxis: {
      type: "value",
      name: "Speed (km/h)",
      nameLocation: "middle",
      nameGap: 30,
    },
    dataZoom: [
      {
        type: "inside",
        start: 95,
        end: 100,
      },
      {
        start: 95,
        end: 100,
      },
    ],
    series: [
      {
        name: "Speed",
        type: "line",
        showSymbol: false,
        encode: {
          x: "Year",
          y: "Income",
          itemName: "Year",
          tooltip: ["Income"],
        },
        smooth: true,
        data: data.map((item, index) => ({
          value: [item.hour, item.speed],
          itemStyle: {
            color: index === displayPosition ? "#ff0000" : undefined,
          },
        })),
      },
    ],
  };

  useEffect(() => {
    if (!chartRef.current) return;

    const echartsInstance = chartRef.current.getEchartsInstance();
    const zr = echartsInstance.getZr();

    zr.on("click", function (params: any) {
      const mouseX = params.offsetX;
      const mouseY = params.offsetY;

      // Get the chart's coordinate system
      const chartWidth = echartsInstance.getWidth();
      const chartHeight = echartsInstance.getHeight();

      // Convert all data points to pixel coordinates
      let closestIndex = -1;
      let minPixelDistance = Infinity;

      data.forEach((item, index) => {
        // Convert data point to pixel coordinates
        const pixelCoords = echartsInstance.convertToPixel({ seriesIndex: 0 }, [
          new Date(item.hour).getTime(),
          item.speed,
        ]);

        if (pixelCoords) {
          // Calculate pixel distance from mouse to this point
          const dx = mouseX - pixelCoords[0];
          const dy = mouseY - pixelCoords[1];
          const pixelDistance = Math.sqrt(dx * dx + dy * dy);

          if (pixelDistance < minPixelDistance) {
            minPixelDistance = pixelDistance;
            closestIndex = index;
          }
        }
      });

      // Only update if we found a point within a reasonable pixel distance
      if (closestIndex !== -1 && minPixelDistance < 50) {
        // 50 pixel threshold
        setDisplayPosition(closestIndex);
        zoom_on_pin(
          positions[closestIndex]?.longitude ?? 0,
          positions[closestIndex]?.latitude ?? 0,
          false,
          setViewState,
          viewState,
          camera_movement,
          10,
        );
      }
    });

    // Cleanup
    return () => {
      if (zr) {
        zr.off("click");
      }
    };
  }, [
    data,
    positions,
    setDisplayPosition,
    zoom_on_pin,
    setViewState,
    viewState,
    camera_movement,
  ]);
  */

  return (
    <div className="w-full h-full flex flex-col">
      {
        /*
       
        <div
          className={`w-full h-56 flex flex-row justify-center items-center gap-2 ${showChart ? "max-h-56" : "max-h-0"} transition-all duration-300 overflow-hidden`}
        >
          <ReactEcharts
            ref={chartRef}
            option={options}
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "canvas" }}
            showLoading={positions.length === 0}
          />
        </div>
 */
      }
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
                camera_movement,
                10,
              );
            }
            setDisplayPosition(Number(e.target.value));
          }}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        {
          /*
           <div
            className="flex justify-center items-center cursor-pointer"
            onClick={() => setShowChart(!showChart)}
          >
            <HiChevronUp
              className={`text-gray-900 dark:text-gray-500 w-5 h-5 transition-transform ease-in-out duration-300 ${showChart ? "rotate-180" : ""}`}
            />
          </div>
          */
        }
         
      </div>
    </div>
  );
}

/*

// Custom comparison function to only re-render when positions change
const areEqual = (prevProps: PulseRangeProps, nextProps: PulseRangeProps) => {
  // Only re-render if positions array length or content changes
  if (prevProps.positions.length !== nextProps.positions.length) {
    return false;
  }

  // Check if any position has changed
  return prevProps.positions.every((pos, index) => {
    const nextPos = nextProps.positions[index];
    return (
      pos.longitude === nextPos.longitude &&
      pos.latitude === nextPos.latitude &&
      pos.speed === nextPos.speed &&
      pos.timestamp === nextPos.timestamp
    );
  });
};

// Export the memoized component
export default memo(PulseRangeComponent, areEqual);
*/

export default PulseRangeComponent;
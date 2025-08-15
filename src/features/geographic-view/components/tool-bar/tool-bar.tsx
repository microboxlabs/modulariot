import { useState, useEffect } from "react";
import { MapPosition } from "../../types/map";
import { ViewStateType } from "../map-visualization-trip";
import { MdGpsFixed, MdGpsNotFixed, MdOutlineTimeline } from "react-icons/md";
import { FaMap, FaMapPin } from "react-icons/fa";
import SettingsIcon from "./settings-icon";
import MapSelector from "./map-selector";
import { mapstyles } from "../map-style-selector";
import PulseRange from "./pulse-range";
import { BsSignStop } from "react-icons/bs";
import Screenshot from "./screenshot";
import { Tooltip } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

type ToolBarProps = {
  positions: MapPosition[] | null;
  displayPosition: number;
  setDisplayPosition: (position: number) => void;
  zoom_on_pin: (
    longitude: number,
    latitude: number,
    clustered: boolean,
    setViewState: (viewState: ViewStateType) => void,
    viewState: ViewStateType,
    camera_movement: boolean,
    zoom?: number
  ) => void;
  setViewState: (viewState: ViewStateType) => void;
  viewState: ViewStateType;
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
  camera_movement: boolean;
  setCameraMovement: (camera_movement: boolean) => void;
  showStops: boolean;
  setShowStops: (showStops: boolean) => void;
  showGeofences: boolean;
  setShowGeofences: (showGeofences: boolean) => void;
  showPulse: boolean;
  setShowPulse: (showPulse: boolean) => void;
  dictionary: I18nRecord;
};

export default function ToolBar({
  positions,
  displayPosition,
  setDisplayPosition,
  zoom_on_pin,
  setViewState,
  viewState,
  selectedStyle,
  setSelectedStyle,
  camera_movement,
  setCameraMovement,
  showStops,
  setShowStops,
  showGeofences,
  setShowGeofences,
  showPulse,
  setShowPulse,
  dictionary,
}: ToolBarProps) {
  const [open, setOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<
    "timeline" | "mapSelection" | null
  >(null);

  useEffect(() => {
    if (!open) {
      setSelectedTool(null);
    }
  }, [open]);

  useEffect(() => {
    if (selectedTool !== "timeline" && positions) {
      setDisplayPosition(positions.length - 1);
    }
  }, [selectedTool]);

  return (
    <div className="w-full h-full flex flex-col justify-end items-start gap-2 pointer-events-none p-5">
      <div className="w-full h-full flex flex-col justify-end items-start gap-2 pointer-events-none relative">
        <div
          className={`absolute bottom-0 left-0 p-2 rounded-lg shadow-lg pointer-events-auto flex flex-col items-center transition-all duration-300 ${selectedTool === "mapSelection" ? "animate-fade-in-fast" : "animate-fade-out-fast"} ${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "bg-white" : "bg-gray-800"}`}
        >
          <MapSelector
            selectedStyle={selectedStyle}
            setSelectedStyle={setSelectedStyle}
          />
        </div>
        <div
          className={`absolute bottom-0 left-0 p-4 right-0 rounded-lg shadow-lg pointer-events-auto flex flex-col items-center transition-all duration-300 ${selectedTool === "timeline" ? "animate-fade-in-fast" : "animate-fade-out-fast"} ${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "bg-white" : "bg-gray-800"}`}
        >
          <PulseRange
            positions={positions ?? []}
            displayPosition={displayPosition}
            setDisplayPosition={setDisplayPosition}
            zoom_on_pin={zoom_on_pin}
            setViewState={setViewState}
            viewState={viewState}
            camera_movement={camera_movement}
          />
        </div>
      </div>

      <div className="flex flex-row items-center gap-2">
        <SettingsIcon
          open={open}
          setOpen={setOpen}
          isDark={
            mapstyles.find((style) => style.value === selectedStyle)?.isDark
          }
        />
        <div
          className={`flex flex-row gap-3 text-sm text-gray-500 transition-all duration-300 overflow-hidden rounded-md ${!open ? "max-w-0 p-0" : "max-w-96 p-1"} ${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "bg-white" : "bg-gray-800"}`}
        >
          <div className="flex flex-row gap-1">
            <Tooltip
              content={
                ((dictionary as I18nRecord).symptoms as I18nRecord)
                  .mapSelection as string
              }
              style={
                mapstyles.find((style) => style.value === selectedStyle)?.isDark
                  ? "light"
                  : "dark"
              }
            >
              <div
                className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-md hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${selectedTool === "mapSelection" ? "bg-blue-500 text-white " : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                onClick={() => {
                  setSelectedTool(
                    selectedTool === "mapSelection" ? null : "mapSelection"
                  );
                }}
              >
                <FaMap size={20} />
              </div>
            </Tooltip>
            <Tooltip
              content={
                ((dictionary as I18nRecord).symptoms as I18nRecord)
                  .timeline as string
              }
              style={
                mapstyles.find((style) => style.value === selectedStyle)?.isDark
                  ? "light"
                  : "dark"
              }
            >
              <div
                className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-md hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${selectedTool === "timeline" ? "bg-blue-500 text-white " : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                onClick={() =>
                  setSelectedTool(
                    selectedTool === "timeline" ? null : "timeline"
                  )
                }
              >
                <MdOutlineTimeline size={20} />
              </div>
            </Tooltip>
          </div>
          {/* Map toggles */}
          <div className="flex flex-row gap-1">
            <Tooltip
              content={
                ((dictionary as I18nRecord).symptoms as I18nRecord)
                  .pulse as string
              }
              style={
                mapstyles.find((style) => style.value === selectedStyle)?.isDark
                  ? "light"
                  : "dark"
              }
            >
              <div
                className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-full hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${showPulse ? "bg-blue-500 text-white " : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                onClick={() => setShowPulse(!showPulse)}
              >
                <div className="w-5 h-5 bg-blue-500 border-2 border-white rounded-full"></div>
              </div>
            </Tooltip>
            <Tooltip
              content={
                ((dictionary as I18nRecord).symptoms as I18nRecord)
                  .stops as string
              }
              style={
                mapstyles.find((style) => style.value === selectedStyle)?.isDark
                  ? "light"
                  : "dark"
              }
            >
              <div
                className={`flex justify-center items-center border-2 border-gray-400 aspect-square h-8 w-8 rounded-full hover:border-blue-500 cursor-pointer pointer-events-auto ${showStops ? "bg-blue-500 text-white" : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                onClick={() => setShowStops(!showStops)}
              >
                <BsSignStop size={20} />
              </div>
            </Tooltip>
            <Tooltip
              content={
                ((dictionary as I18nRecord).symptoms as I18nRecord)
                  .geofences as string
              }
              style={
                mapstyles.find((style) => style.value === selectedStyle)?.isDark
                  ? "light"
                  : "dark"
              }
            >
              <div
                className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-full hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${showGeofences ? "bg-blue-500 text-white " : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                onClick={() => setShowGeofences(!showGeofences)}
              >
                <FaMapPin size={20} />
              </div>
            </Tooltip>
          </div>
          {/* Map toggles */}

          {/* Action toggles */}
          <div className="flex flex-row gap-1">
            <Tooltip
              content={
                ((dictionary as I18nRecord).symptoms as I18nRecord)
                  .cameraMovement as string
              }
              style={
                mapstyles.find((style) => style.value === selectedStyle)?.isDark
                  ? "light"
                  : "dark"
              }
            >
              <div
                className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-md hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${camera_movement ? "bg-blue-500 text-white " : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                onClick={() => {
                  setCameraMovement(!camera_movement);
                }}
              >
                {camera_movement ? (
                  <MdGpsFixed size={20} />
                ) : (
                  <MdGpsNotFixed size={20} />
                )}
              </div>
            </Tooltip>
          </div>
          {/* Action toggles */}
          {/* General Actions */}
          <Tooltip
            content={
              ((dictionary as I18nRecord).symptoms as I18nRecord)
                .screenshot as string
            }
            style={
              mapstyles.find((style) => style.value === selectedStyle)?.isDark
                ? "light"
                : "dark"
            }
          >
            <div
              className={`flex flex-row gap-1 ${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`}
            >
              <Screenshot />
            </div>
          </Tooltip>
          {/* General Actions */}
        </div>
      </div>
    </div>
  );
}

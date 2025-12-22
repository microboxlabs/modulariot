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
import { tr } from "@/features/i18n/tr.service";
import { twMerge } from "tailwind-merge";
import TimeRangeSelector from "./time-range-selector";
import TimelineComponent from "@/features/symptoms/components/map-view/timeline";

type ToolBarProps = {
  positions: MapPosition[] | null;
  display_position: {
    displayPosition: number;
    setDisplayPosition: (position: number) => void;
  };
  selected_style?: {
    selectedStyle: string;
    setSelectedStyle: (style: string) => void;
  };
  camera_movement?: {
    camera_movement: boolean;
    setCameraMovement: (camera_movement: boolean) => void;
  };
  show_stops?: {
    showStops: boolean;
    setShowStops: (showStops: boolean) => void;
  };
  show_geofences?: {
    showGeofences: boolean;
    setShowGeofences: (showGeofences: boolean) => void;
  };
  show_pulse?: {
    showPulse: boolean;
    setShowPulse: (showPulse: boolean) => void;
  };
  allow_screenshot?: boolean;
  dictionary: I18nRecord;
  defaultOpenTimeline?: boolean;
  timelineComponent: React.ReactNode;
};

export default function ToolBar({
  positions,
  display_position,
  selected_style,
  camera_movement,
  show_stops,
  show_geofences,
  show_pulse,
  allow_screenshot = true,
  dictionary,
  defaultOpenTimeline,
  timelineComponent,
}: ToolBarProps) {
  const selectedStyle = selected_style?.selectedStyle ?? "";
  const setSelectedStyle = selected_style?.setSelectedStyle ?? (() => {});
  const [open, setOpen] = useState(defaultOpenTimeline ?? false);
  const [selectedTool, setSelectedTool] = useState<
    "timeline" | "mapSelection" | null
  >(defaultOpenTimeline == true ? "timeline" : null);

  useEffect(() => {
    if (!open) {
      setSelectedTool(null);
    }
  }, [open]);

  useEffect(() => {
    if (selectedTool !== "timeline" && positions) {
      display_position.setDisplayPosition(positions.length - 1);
    }
  }, [selectedTool]);

  const style_bg = mapstyles.find((style) => style.value === selectedStyle)
    ?.isDark
    ? "bg-white"
    : "bg-gray-800";

  const style_theme = mapstyles.find((style) => style.value === selectedStyle)
    ?.isDark
    ? "light"
    : "dark";

  return (
    <div className="w-full h-full flex flex-col justify-end items-start gap-2 pointer-events-none p-5">
      <div className="w-full h-full flex flex-col justify-end items-start gap-2 pointer-events-none relative">
        <div
          className={twMerge(
            "absolute bottom-0 left-0",
            "p-2",
            "rounded-lg shadow-lg pointer-events-auto",
            "flex flex-col items-center",
            "transition-all duration-300",
            selectedTool === "mapSelection"
              ? "animate-fade-in-fast"
              : "hidden animate-fade-out-fast",
            style_bg
          )}
        >
          <MapSelector
            selectedStyle={selectedStyle}
            setSelectedStyle={setSelectedStyle}
          />
        </div>
        <div
          className={twMerge(
            "absolute bottom-0 left-0 right-0",
            "p-4",
            "rounded-lg shadow-lg pointer-events-auto",
            "flex flex-col items-center",
            "transition-all duration-300",
            selectedTool === "timeline"
              ? "animate-fade-in-fast"
              : "animate-fade-out-fast hidden",
            style_bg
          )}
        >
          {timelineComponent}
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
          {selected_style && (
            <div className="flex flex-row gap-1">
              <Tooltip
                content={tr("symptoms.mapSelection", dictionary)}
                style={style_theme}
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
                content={tr("symptoms.timeline", dictionary)}
                style={style_theme}
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
          )}
          {/* Map toggles */}
          {(show_pulse || show_stops || show_geofences) && (
            <div className="flex flex-row gap-1">
              {show_pulse && (
                <Tooltip
                  content={tr("symptoms.pulse", dictionary)}
                  style={style_theme}
                >
                  <div
                    className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-lg hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${show_pulse.showPulse ? "bg-blue-500 text-white " : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                    onClick={() =>
                      show_pulse.setShowPulse(!show_pulse.showPulse)
                    }
                  >
                    <div className="w-5 h-5 bg-blue-500 border-2 border-white rounded-full"></div>
                  </div>
                </Tooltip>
              )}
              {show_stops && (
                <Tooltip
                  content={tr("symptoms.stops", dictionary)}
                  style={style_theme}
                >
                  <div
                    className={`flex justify-center items-center border-2 border-gray-400 aspect-square h-8 w-8 rounded-lg hover:border-blue-500 cursor-pointer pointer-events-auto ${show_stops.showStops ? "bg-blue-500 text-white" : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                    onClick={() =>
                      show_stops.setShowStops(!show_stops.showStops)
                    }
                  >
                    <BsSignStop size={20} />
                  </div>
                </Tooltip>
              )}

              {show_geofences && (
                <Tooltip
                  content={tr("symptoms.geofences", dictionary)}
                  style={style_theme}
                >
                  <div
                    className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-lg hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${show_geofences.showGeofences ? "bg-blue-500 text-white " : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                    onClick={() =>
                      show_geofences.setShowGeofences(
                        !show_geofences.showGeofences
                      )
                    }
                  >
                    <FaMapPin size={20} />
                  </div>
                </Tooltip>
              )}
            </div>
          )}
          {/* Map toggles */}

          {/* Action toggles */}
          {camera_movement && (
            <div className="flex flex-row gap-1">
              <Tooltip
                content={tr("symptoms.cameraMovement", dictionary)}
                style={style_theme}
              >
                <div
                  className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-md hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${camera_movement ? "bg-blue-500 text-white " : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                  onClick={() => {
                    camera_movement.setCameraMovement(!camera_movement);
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
          )}

          {/* Action toggles */}
          {/* General Actions */}
          {allow_screenshot && (
            <Tooltip
              content={tr("symptoms.screenshot", dictionary)}
              style={style_theme}
            >
              <div
                className={`flex flex-row gap-1 ${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`}
              >
                <Screenshot />
              </div>
            </Tooltip>
          )}
          {/* General Actions */}
        </div>
      </div>
    </div>
  );
}

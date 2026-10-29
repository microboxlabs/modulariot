import { useState, useEffect, useRef } from "react";
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
import GeofencesModeSelector, {
  type GeofencesMode,
} from "./geofences-mode-selector";

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
  geofences_mode?: {
    geofencesMode: GeofencesMode;
    setGeofencesMode: (geofencesMode: GeofencesMode) => void;
  };
  show_pulse?: {
    showPulse: boolean;
    setShowPulse: (showPulse: boolean) => void;
  };
  allow_screenshot?: boolean;
  dictionary: I18nRecord;
  defaultOpenTimeline?: boolean;
  timelineComponent?: React.ReactNode;
};

export default function ToolBar({
  positions,
  display_position,
  selected_style,
  camera_movement,
  show_stops,
  geofences_mode,
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
    "timeline" | "mapSelection" | "geofences" | null
  >(defaultOpenTimeline == true ? "timeline" : null);
  // the geofences panel opens centred over its button; the button row clips
  // its overflow, so the panel lives in the area above and is placed by hand
  const panelAreaRef = useRef<HTMLDivElement>(null);
  const geofencesButtonRef = useRef<HTMLDivElement>(null);
  const [geofencesPanelLeft, setGeofencesPanelLeft] = useState(0);

  const toggleGeofencesPanel = () => {
    const area = panelAreaRef.current?.getBoundingClientRect();
    const button = geofencesButtonRef.current?.getBoundingClientRect();
    if (area && button) {
      setGeofencesPanelLeft(button.left + button.width / 2 - area.left);
    }
    setSelectedTool(selectedTool === "geofences" ? null : "geofences");
  };

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

  const geofencesPanelOpen = selectedTool === "geofences";
  const geofencesInactiveText = mapstyles.find(
    (style) => style.value === selectedStyle
  )?.isDark
    ? "text-gray-500"
    : "text-gray-300";
  const geofencesModeClass =
    geofences_mode?.geofencesMode === "none"
      ? geofencesInactiveText
      : "bg-blue-500 text-white ";
  const geofencesButton = geofences_mode && (
    <div
      ref={geofencesButtonRef}
      data-geofences-button
      className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-lg hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${geofencesModeClass} ${geofencesPanelOpen ? "border-blue-500" : ""}`}
      onClick={toggleGeofencesPanel}
    >
      <FaMapPin size={20} />
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col justify-end items-start gap-2 pointer-events-none p-5">
      <div
        ref={panelAreaRef}
        className="w-full h-full flex flex-col justify-end items-start gap-2 pointer-events-none relative"
      >
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
        {geofences_mode && (
          <div
            data-geofences-panel
            style={{ left: geofencesPanelLeft }}
            className={twMerge(
              "absolute bottom-0 -translate-x-1/2",
              "p-2",
              "rounded-lg shadow-lg pointer-events-auto",
              "transition-all duration-300",
              geofencesPanelOpen
                ? "animate-fade-in-fast"
                : "hidden animate-fade-out-fast",
              style_bg
            )}
          >
            {/* arrow pointing down to the geofences button */}
            <span
              aria-hidden
              className={twMerge(
                "absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45",
                style_bg
              )}
            />
            <GeofencesModeSelector
              mode={geofences_mode.geofencesMode}
              setMode={geofences_mode.setGeofencesMode}
              dictionary={dictionary}
            />
          </div>
        )}
        {timelineComponent && (
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
        )}
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
              {timelineComponent && (
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
              )}
            </div>
          )}
          {/* Map toggles */}
          {(show_pulse || show_stops || geofences_mode) && (
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

              {geofencesButton &&
                (geofencesPanelOpen ? (
                  // with its panel open the hover tooltip would cover it
                  geofencesButton
                ) : (
                  <Tooltip
                    content={tr("symptoms.geofences", dictionary)}
                    style={style_theme}
                  >
                    {geofencesButton}
                  </Tooltip>
                ))}
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
                  className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-md hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center ${camera_movement.camera_movement ? "bg-blue-500 text-white " : `${mapstyles.find((style) => style.value === selectedStyle)?.isDark ? "text-gray-500" : "text-gray-300"}`} `}
                  onClick={() => {
                    camera_movement.setCameraMovement(
                      !camera_movement.camera_movement
                    );
                  }}
                >
                  {camera_movement.camera_movement ? (
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

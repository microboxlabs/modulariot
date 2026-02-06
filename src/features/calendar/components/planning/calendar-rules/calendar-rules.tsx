"use client";

import { Button } from "flowbite-react";
import { useState } from "react";
import { FaGear } from "react-icons/fa6";
import QuotaManager from "./quota-manager";
import TimeBlockManager from "./time-block-manager";
import AndenesManager, { type PlatformConfig } from "./andenes-manager";
import { ChevronLeft } from "flowbite-react-icons/outline";
import { type TimeWindow, type TimeBlock } from "../planning-selection-context";
import type { ReactNode } from "react";

type SettingOption = "quota" | "timeBlock" | "andenes" | null;

function isSectionExpanded(
  selected: SettingOption,
  option: SettingOption
): boolean {
  return selected === null || selected === option;
}

function isSectionActive(
  selected: SettingOption,
  option: SettingOption
): boolean {
  return selected === option;
}

function isKeyboardActivate(key: string): boolean {
  return key === "Enter" || key === " ";
}

interface CalendarRulesSectionProps {
  option: NonNullable<SettingOption>;
  selected: SettingOption;
  setSelected: (v: SettingOption) => void;
  title: string;
  description: string;
  children: ReactNode;
  layout: "quota" | "default";
}

function CalendarRulesSection({
  option,
  selected,
  setSelected,
  title,
  description,
  children,
  layout,
}: Readonly<CalendarRulesSectionProps>) {
  const active = isSectionActive(selected, option);
  const expanded = isSectionExpanded(selected, option);

  const handleSelect = () => {
    if (!active) setSelected(option);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!active && isKeyboardActivate(e.key)) setSelected(option);
  };

  const handleBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
  };

  const headerHeightClass = expanded ? "h-20" : "h-0";
  const headerInteractiveClass = active
    ? ""
    : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700";
  const contentMaxHeightClass = active ? "max-h-[500px]" : "max-h-0 ";

  if (layout === "quota") {
    return (
      <div>
        <div
          role={active ? undefined : "button"}
          tabIndex={active ? undefined : 0}
          onClick={handleSelect}
          onKeyDown={handleKeyDown}
          className={`w-full transition-all duration-300 overflow-hidden ${headerHeightClass} ${headerInteractiveClass}`}
        >
          <div
            className={`flex flex-row h-full items-center px-4 transition-all duration-500 ${active ? "gap-4" : "gap-0"}`}
          >
            <Button
              className={`h-10 w-10 shrink-0 text-gray-700 p-0 transition-all duration-300 overflow-hidden ${active ? "opacity-100 max-w-10 scale-100" : "opacity-0 max-w-0 scale-75"}`}
              color="alternative"
              disabled={!active}
              onClick={handleBack}
            >
              <ChevronLeft />
            </Button>
            <div className="py-3 w-full border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-left">
                {title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-left">
                {description}
              </p>
            </div>
          </div>
        </div>
        <div
          className={`${contentMaxHeightClass} transition-all duration-300 overflow-hidden`}
        >
          {children}
        </div>
      </div>
    );
  }

  const backButtonOpacityClass = active
    ? "opacity-100 translate-x-0"
    : "opacity-0 -translate-x-2 pointer-events-none";
  const contentMarginClass = active ? "ml-14" : "ml-0";

  return (
    <>
      <div
        role={active ? undefined : "button"}
        tabIndex={active ? undefined : 0}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        className={`w-full transition-all duration-300 overflow-hidden ${headerHeightClass} ${headerInteractiveClass}`}
      >
        <div className="relative flex flex-row h-full items-center pl-4 pr-4">
          <div
            className={`absolute left-4 transition-all duration-300 ease-out ${backButtonOpacityClass}`}
          >
            <Button
              className="h-10 w-10 shrink-0 text-gray-700 p-0"
              color="alternative"
              disabled={!active}
              onClick={handleBack}
            >
              <ChevronLeft />
            </Button>
          </div>
          <div
            className={`py-3 w-full h-full transition-all duration-300 ease-out border-b border-gray-200 dark:border-gray-700 ${contentMarginClass}`}
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-left">
              {title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-left">
              {description}
            </p>
          </div>
        </div>
      </div>
      <div
        className={`${contentMaxHeightClass} transition-all duration-300 overflow-hidden`}
      >
        {children}
      </div>
    </>
  );
}

interface CalendarRulesProps {
  onRulesChange?: (windows: TimeWindow[]) => void;
  onBlocksChange?: (blocks: TimeBlock[]) => void;
  onAndenesChange?: (config: PlatformConfig) => void;
}

export default function CalendarRules({
  onRulesChange,
  onBlocksChange,
  onAndenesChange,
}: Readonly<CalendarRulesProps>) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SettingOption>(null);

  const togglePanel = () => {
    setSelected(null);
    setOpen((prev) => !prev);
  };

  const closePanel = () => setOpen(false);

  return (
    <div className="relative">
      <Button
        color="alternative"
        size="sm"
        onClick={togglePanel}
        title="Configurar ventanas de tiempo"
      >
        <FaGear />
      </Button>
      {open && (
        <div className="absolute z-50 right-0 top-full mt-2 h-fit bg-white dark:bg-gray-800 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[320px] w-[400px]">
          <CalendarRulesSection
            option="quota"
            selected={selected}
            setSelected={setSelected}
            title="Gestion de cupos"
            description="Define las ventanas de tiempo disponibles asi como sus cupos maximos."
            layout="quota"
          >
            <QuotaManager
              onRulesChange={(windows) => {
                onRulesChange?.(windows);
                closePanel();
              }}
            />
          </CalendarRulesSection>

          <CalendarRulesSection
            option="timeBlock"
            selected={selected}
            setSelected={setSelected}
            title="Bloqueos temporales"
            description='Define periodos horarios o diarios como "bloqueados".'
            layout="default"
          >
            <TimeBlockManager
              onBlocksChange={(blocks) => {
                onBlocksChange?.(blocks);
                closePanel();
              }}
            />
          </CalendarRulesSection>

          <CalendarRulesSection
            option="andenes"
            selected={selected}
            setSelected={setSelected}
            title="Configuración de andenes"
            description="Define el número de andenes disponibles por franja."
            layout="default"
          >
            <AndenesManager
              onConfigChange={(config) => {
                onAndenesChange?.(config);
                closePanel();
              }}
            />
          </CalendarRulesSection>
        </div>
      )}
    </div>
  );
}

export type { TimeWindow, TimeBlock, PlatformConfig };

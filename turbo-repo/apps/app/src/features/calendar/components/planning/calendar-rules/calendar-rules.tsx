"use client";

import { Button } from "flowbite-react";
import { useState } from "react";
import { FaGear } from "react-icons/fa6";
import QuotaManager, { getQuotaManagerMessages } from "./quota-manager";
import TimeBlockManager, {
  getTimeBlockManagerMessages,
} from "./time-block-manager";
import AndenesManager, {
  type PlatformConfig,
  getAndenesManagerMessages,
} from "./andenes-manager";
import FilterManager, { getFilterManagerMessages } from "./filter-manager";
import type { CalendarFilter } from "@microboxlabs/miot-calendar-client";
import { ChevronLeft } from "flowbite-react-icons/outline";
import { twMerge } from "tailwind-merge";
import { type TimeWindow, type TimeBlock } from "../planning-selection-context";
import type { ReactNode } from "react";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

type SettingOption = "quota" | "timeBlock" | "andenes" | "filter" | null;

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

function getSectionClasses(expanded: boolean, active: boolean) {
  return {
    headerHeightClass: expanded ? "h-20" : "h-0",
    headerInteractiveClass: active
      ? ""
      : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-full",
    contentMaxHeightClass: active ? "max-h-[500px]" : "max-h-0 ",
  };
}

interface SectionLayoutProps {
  active: boolean;
  title: string;
  description: string;
  children: ReactNode;
  classes: ReturnType<typeof getSectionClasses>;
  onSelect: () => void;
  onBack: (e: React.MouseEvent) => void;
}

function SectionLayout({
  active,
  title,
  description,
  children,
  classes,
  onSelect,
  onBack,
}: Readonly<SectionLayoutProps>) {
  const { headerHeightClass, headerInteractiveClass, contentMaxHeightClass } =
    classes;
  const backButtonClass = active
    ? "opacity-100 w-10"
    : "opacity-0 w-0 pointer-events-none";

  const handleClick = (e: React.MouseEvent) => {
    if (active) {
      onBack(e);
    } else {
      onSelect();
    }
  };

  return (
    <div>
      <div
        className={twMerge(
          "transition-all duration-300 overflow-hidden",
          headerHeightClass
        )}
      >
        <Button
          type="button"
          color="alternative"
          onClick={handleClick}
          className={twMerge(
            "w-full border-0 bg-transparent p-0 m-0 text-left font-inherit",
            "flex flex-row h-full items-center transition-all duration-300",
            "border-b border-gray-200 dark:border-gray-700 rounded-none",
            headerInteractiveClass
          )}
        >
          <span
            className={twMerge(
              "h-10 ml-3 mr-3 shrink-0 flex items-center justify-center",
              "text-gray-700 dark:text-gray-300 transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg",
              backButtonClass
            )}
          >
            <ChevronLeft />
          </span>
          <span className="flex-1 py-3 pr-3 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-left">
              {title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-left">
              {description}
            </p>
          </span>
        </Button>
      </div>
      <div
        className={`${contentMaxHeightClass} transition-all duration-300 overflow-hidden`}
      >
        {children}
      </div>
    </div>
  );
}

interface CalendarRulesSectionProps {
  option: NonNullable<SettingOption>;
  selected: SettingOption;
  setSelected: (v: SettingOption) => void;
  title: string;
  description: string;
  children: ReactNode;
}

function CalendarRulesSection({
  option,
  selected,
  setSelected,
  title,
  description,
  children,
}: Readonly<CalendarRulesSectionProps>) {
  const active = isSectionActive(selected, option);
  const expanded = isSectionExpanded(selected, option);
  const classes = getSectionClasses(expanded, active);

  const handleSelect = () => {
    if (!active) setSelected(option);
  };

  const handleBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
  };

  return (
    <SectionLayout
      active={active}
      title={title}
      description={description}
      classes={classes}
      onSelect={handleSelect}
      onBack={handleBack}
    >
      {children}
    </SectionLayout>
  );
}

export interface CalendarRulesMessages {
  configureTimeWindows: string;
  quotaManagement: {
    title: string;
    description: string;
  };
  timeBlocks: {
    title: string;
    description: string;
  };
  platformConfig: {
    title: string;
    description: string;
  };
  taskFilter: {
    title: string;
    description: string;
  };
}

const CALENDAR_RULES_BASE = "layout.planning.calendarRules" as const;

export function getCalendarRulesMessages(
  dict: I18nDictionary
): CalendarRulesMessages {
  return {
    configureTimeWindows: tr(
      `${CALENDAR_RULES_BASE}.configureTimeWindows`,
      dict
    ),
    quotaManagement: {
      title: tr(`${CALENDAR_RULES_BASE}.quotaManagement.title`, dict),
      description: tr(
        `${CALENDAR_RULES_BASE}.quotaManagement.description`,
        dict
      ),
    },
    timeBlocks: {
      title: tr(`${CALENDAR_RULES_BASE}.timeBlocks.title`, dict),
      description: tr(`${CALENDAR_RULES_BASE}.timeBlocks.description`, dict),
    },
    platformConfig: {
      title: tr(`${CALENDAR_RULES_BASE}.platformConfig.title`, dict),
      description: tr(
        `${CALENDAR_RULES_BASE}.platformConfig.description`,
        dict
      ),
    },
    taskFilter: {
      title: tr(`${CALENDAR_RULES_BASE}.taskFilter.title`, dict),
      description: tr(`${CALENDAR_RULES_BASE}.taskFilter.description`, dict),
    },
  };
}

interface CalendarRulesProps {
  dict: I18nDictionary;
  messages: CalendarRulesMessages;
  andenesCount?: number;
  taskFilter?: CalendarFilter;
  onRulesChange?: (windows: TimeWindow[]) => void;
  onBlocksChange?: (blocks: TimeBlock[]) => void;
  onAndenesChange?: (config: PlatformConfig) => void;
  onTaskFilterChange?: (filter: CalendarFilter) => void;
}

export default function CalendarRules({
  dict,
  messages,
  andenesCount,
  taskFilter,
  onRulesChange,
  onBlocksChange,
  onAndenesChange,
  onTaskFilterChange,
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
        title={messages.configureTimeWindows}
      >
        <FaGear />
      </Button>
      {open && (
        <div className="absolute z-50 right-0 top-full mt-2 h-fit bg-white dark:bg-gray-800 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[320px] w-[400px]">
          <CalendarRulesSection
            option="quota"
            selected={selected}
            setSelected={setSelected}
            title={messages.quotaManagement.title}
            description={messages.quotaManagement.description}
          >
            <QuotaManager
              messages={getQuotaManagerMessages(dict)}
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
            title={messages.timeBlocks.title}
            description={messages.timeBlocks.description}
          >
            <TimeBlockManager
              messages={getTimeBlockManagerMessages(dict)}
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
            title={messages.platformConfig.title}
            description={messages.platformConfig.description}
          >
            <AndenesManager
              messages={getAndenesManagerMessages(dict)}
              initialCount={andenesCount}
              onConfigChange={(config) => {
                onAndenesChange?.(config);
                closePanel();
              }}
            />
          </CalendarRulesSection>

          <CalendarRulesSection
            option="filter"
            selected={selected}
            setSelected={setSelected}
            title={messages.taskFilter.title}
            description={messages.taskFilter.description}
          >
            <FilterManager
              messages={getFilterManagerMessages(dict)}
              initialFilter={taskFilter}
              onFilterChange={(filter) => {
                onTaskFilterChange?.(filter);
                closePanel();
              }}
            />
          </CalendarRulesSection>
        </div>
      )}
    </div>
  );
}

export type { TimeWindow, TimeBlock } from "../planning-selection-context";
export type { PlatformConfig } from "./andenes-manager";

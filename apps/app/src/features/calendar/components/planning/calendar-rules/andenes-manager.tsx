"use client";

import { Button, TextInput, Label } from "flowbite-react";
import { useState, useCallback, useEffect } from "react";
import { HiMinus, HiPlus, HiCheck } from "react-icons/hi";
import { TbTruckLoading } from "react-icons/tb";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export interface PlatformConfig {
  id: string;
  count: number;
}

export interface AndenesManagerMessages {
  availablePlatforms: string;
  infoSingular: string;
  infoPlural: string;
  save: string;
}

const ANDENES_MANAGER_BASE =
  "layout.planning.calendarRules.platformConfig" as const;

export function getAndenesManagerMessages(
  dict: I18nDictionary
): AndenesManagerMessages {
  return {
    availablePlatforms: tr(`${ANDENES_MANAGER_BASE}.availablePlatforms`, dict),
    infoSingular: tr(`${ANDENES_MANAGER_BASE}.infoSingular`, dict),
    infoPlural: tr(`${ANDENES_MANAGER_BASE}.infoPlural`, dict),
    save: tr(`${ANDENES_MANAGER_BASE}.save`, dict),
  };
}

interface AndenesManagerProps {
  messages: AndenesManagerMessages;
  initialCount?: number;
  onConfigChange?: (config: PlatformConfig) => void;
}

/**
 * Andenes Manager - Configure loading docks/platforms for the terminal
 * Users can assign X andenes when booking a time slot
 */
export default function AndenesManager({
  messages,
  initialCount = 1,
  onConfigChange,
}: Readonly<AndenesManagerProps>) {
  const [platformCount, setPlatformCount] = useState<number>(initialCount);
  // Local input state - allows empty string while typing
  const [inputValue, setInputValue] = useState<string>(String(initialCount));

  // Sync from parent when initialCount changes (e.g. backend load)
  useEffect(() => {
    setPlatformCount(initialCount);
    setInputValue(String(initialCount));
  }, [initialCount]);

  // Sync input value when platformCount changes from buttons
  useEffect(() => {
    setInputValue(String(platformCount));
  }, [platformCount]);

  const commitInputValue = useCallback(() => {
    const val = Number.parseInt(inputValue, 10);
    if (!Number.isNaN(val) && val >= 1 && val <= 99) {
      setPlatformCount(val);
      setInputValue(String(val));
    } else {
      // Reset to current valid value if invalid
      setInputValue(String(platformCount));
    }
  }, [inputValue, platformCount]);

  const handleSave = useCallback(() => {
    const config: PlatformConfig = {
      id: crypto.randomUUID(),
      count: platformCount,
    };
    onConfigChange?.(config);
  }, [platformCount, onConfigChange]);

  const incrementCount = useCallback(() => {
    setPlatformCount((prev) => Math.min(prev + 1, 99));
  }, []);

  const decrementCount = useCallback(() => {
    setPlatformCount((prev) => Math.max(prev - 1, 1));
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label
          htmlFor="platform-count"
          className="text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          {messages.availablePlatforms}
        </Label>
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            color="alternative"
            onClick={decrementCount}
            disabled={platformCount <= 1}
            className="h-9 w-9 p-0 shrink-0"
          >
            <HiMinus className="h-4 w-4" />
          </Button>
          <TextInput
            id="platform-count"
            type="number"
            min={1}
            max={99}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitInputValue();
              }
            }}
            onBlur={commitInputValue}
            className="flex-1 [&_input]:text-center"
            sizing="sm"
          />
          <Button
            size="xs"
            color="alternative"
            onClick={incrementCount}
            disabled={platformCount >= 99}
            className="h-9 w-9 p-0 shrink-0"
          >
            <HiPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
        <TbTruckLoading className="h-4 w-4 shrink-0" />
        <span>
          {(platformCount === 1
            ? messages.infoSingular
            : messages.infoPlural
          ).replace("{count}", String(platformCount))}
        </span>
      </div>

      {/* Save Button */}
      <Button color="blue" size="sm" className="w-full" onClick={handleSave}>
        <HiCheck className="mr-2 h-4 w-4" />
        {messages.save}
      </Button>
    </div>
  );
}

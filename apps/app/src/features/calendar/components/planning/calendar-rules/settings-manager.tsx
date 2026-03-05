"use client";

import { useState, useCallback, useEffect } from "react";
import { Button, Label, TextInput } from "flowbite-react";
import { HiMinus, HiPlus, HiCheck } from "react-icons/hi";
import { HiClock } from "react-icons/hi2";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { usePlanningSelection } from "../planning-selection-context";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export interface SettingsManagerMessages {
  slotDuration: string;
  slotDurationDescription: string;
  apply: string;
  minutes: string;
}

const SETTINGS_MANAGER_BASE = "layout.planning.calendarRules.settings" as const;

export function getSettingsManagerMessages(
  dict: I18nDictionary
): SettingsManagerMessages {
  return {
    slotDuration: tr(`${SETTINGS_MANAGER_BASE}.slotDuration`, dict),
    slotDurationDescription: tr(
      `${SETTINGS_MANAGER_BASE}.slotDurationDescription`,
      dict
    ),
    apply: tr(`${SETTINGS_MANAGER_BASE}.apply`, dict),
    minutes: tr(`${SETTINGS_MANAGER_BASE}.minutes`, dict),
  };
}

interface SettingsManagerProps {
  messages: SettingsManagerMessages;
  onSettingsChange?: (settings: { slotDurationMinutes: number }) => void;
}

export default function SettingsManager({
  messages,
  onSettingsChange,
}: Readonly<SettingsManagerProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { slotDurationMinutes: contextSlotDuration } = usePlanningSelection();

  const [slotDuration, setSlotDuration] = useState(contextSlotDuration);
  const [inputValue, setInputValue] = useState(String(contextSlotDuration));

  // Sync local state with context when it changes
  useEffect(() => {
    setSlotDuration(contextSlotDuration);
    setInputValue(String(contextSlotDuration));
  }, [contextSlotDuration]);

  const commitInputValue = useCallback(() => {
    const val = parseInt(inputValue, 10);
    if (!isNaN(val) && val >= 1 && val <= 60) {
      setSlotDuration(val);
      setInputValue(String(val));
    } else {
      setInputValue(String(slotDuration));
    }
  }, [inputValue, slotDuration]);

  const incrementCount = useCallback(() => {
    setSlotDuration((prev) => {
      const next = Math.min(prev + 1, 60);
      setInputValue(String(next));
      return next;
    });
  }, []);

  const decrementCount = useCallback(() => {
    setSlotDuration((prev) => {
      const next = Math.max(prev - 1, 1);
      setInputValue(String(next));
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (slotDuration === 30) {
      params.delete("slotDuration");
    } else {
      params.set("slotDuration", String(slotDuration));
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    onSettingsChange?.({ slotDurationMinutes: slotDuration });
  }, [router, pathname, searchParams, slotDuration, onSettingsChange]);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label
          htmlFor="slotDurationInput"
          className="text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          {messages.slotDuration} ({messages.minutes})
        </Label>
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            color="alternative"
            onClick={decrementCount}
            disabled={slotDuration <= 1}
            className="h-9 w-9 p-0 shrink-0"
          >
            <HiMinus className="h-4 w-4" />
          </Button>
          <TextInput
            id="slotDurationInput"
            type="number"
            min={1}
            max={60}
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
            disabled={slotDuration >= 60}
            className="h-9 w-9 p-0 shrink-0"
          >
            <HiPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
        <HiClock className="h-4 w-4 shrink-0" />
        <span>{messages.slotDurationDescription}</span>
      </div>

      {/* Apply Button */}
      <Button color="blue" size="sm" className="w-full" onClick={handleApply}>
        <HiCheck className="mr-2 h-4 w-4" />
        {messages.apply}
      </Button>
    </div>
  );
}

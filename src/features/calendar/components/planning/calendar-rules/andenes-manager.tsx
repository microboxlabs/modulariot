"use client";

import { Button, TextInput, Label } from "flowbite-react";
import { useState, useCallback, useEffect } from "react";
import { HiMinus, HiPlus, HiCheck } from "react-icons/hi";
import { TbTruckLoading } from "react-icons/tb";

export interface PlatformConfig {
  id: string;
  count: number;
}

interface AndenesManagerProps {
  onConfigChange?: (config: PlatformConfig) => void;
}

/**
 * Andenes Manager - Configure loading docks/platforms for the terminal
 * Users can assign X andenes when booking a time slot
 */
export default function AndenesManager({
  onConfigChange,
}: Readonly<AndenesManagerProps>) {
  const [platformCount, setPlatformCount] = useState<number>(1);
  // Local input state - allows empty string while typing
  const [inputValue, setInputValue] = useState<string>("1");

  // Sync input value when platformCount changes from buttons
  useEffect(() => {
    setInputValue(String(platformCount));
  }, [platformCount]);

  const commitInputValue = useCallback(() => {
    const val = parseInt(inputValue, 10);
    if (!isNaN(val) && val >= 1 && val <= 99) {
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
          Andenes disponibles en el terminal
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
          Los usuarios podrán agendar hasta{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            {platformCount}
          </span>{" "}
          {platformCount === 1 ? "servicio" : "servicios"} en la misma franja
          horaria.
        </span>
      </div>

      {/* Save Button */}
      <Button color="blue" size="sm" className="w-full" onClick={handleSave}>
        <HiCheck className="mr-2 h-4 w-4" />
        Guardar
      </Button>
    </div>
  );
}

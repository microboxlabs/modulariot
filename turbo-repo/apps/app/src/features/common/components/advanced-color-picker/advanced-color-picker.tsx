"use client";

import { useState, useCallback, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { TextInput, Button } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import { usePickerDropdown } from "../../hooks/use-picker-dropdown";

/** Preset color options */
export interface PresetColor {
  /** The color value (hex without #) */
  value: string;
  /** Display label */
  label: string;
}

/** Default preset colors matching the icon color options */
export const DEFAULT_PRESETS: PresetColor[] = [
  { value: "3b82f6", label: "Blue" },
  { value: "22c55e", label: "Green" },
  { value: "a855f7", label: "Purple" },
  { value: "f97316", label: "Orange" },
  { value: "ef4444", label: "Red" },
  { value: "6b7280", label: "Gray" },
  { value: "eab308", label: "Yellow" },
  { value: "ec4899", label: "Pink" },
];

interface AdvancedColorPickerProps {
  /** Currently selected color (hex without #) */
  value: string;
  /** Callback when color changes */
  onChange: (color: string) => void;
  /** Preset colors to show */
  presets?: PresetColor[];
  /** Tooltip text for the trigger button */
  title?: string;
  /** Additional classes for the trigger button */
  className?: string;
}

/** Parse hex to RGB */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = Number.parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/** Convert RGB to hex */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return [clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

/** Convert HSV to RGB */
function hsvToRgb(
  h: number,
  s: number,
  v: number
): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Convert RGB to HSV */
function rgbToHsv(
  r: number,
  g: number,
  b: number
): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }

  return { h, s, v };
}

/**
 * Advanced color picker with square picker, RGB inputs, and presets
 */
export function AdvancedColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  title = "Select color",
  className,
}: Readonly<AdvancedColorPickerProps>) {
  const { isOpen, position, triggerRef, toggle, close } = usePickerDropdown({
    portalDataAttribute: "data-advcolorpicker-portal",
    dropdownWidth: 224, // w-56 = 14rem = 224px
    dropdownHeight: 280, // approximate height of the picker
  });

  // Close dropdown when component unmounts (e.g., when settings dialog closes)
  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  const [localRgb, setLocalRgb] = useState(() => hexToRgb(value));
  const [hue, setHue] = useState(
    () => rgbToHsv(localRgb.r, localRgb.g, localRgb.b).h
  );
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const isDraggingSquare = useRef(false);
  const isDraggingHue = useRef(false);
  const inputIdPrefix = useId();

  // Sync local state when external value changes (but not while dragging square)
  useEffect(() => {
    // Skip hue update while dragging on the square to prevent hue jumps at low saturation
    if (isDraggingSquare.current) {
      setLocalRgb(hexToRgb(value));
      return;
    }
    const rgb = hexToRgb(value);
    setLocalRgb(rgb);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    if (hsv.s > 0 || hsv.v > 0) {
      setHue(hsv.h);
    }
  }, [value]);

  const updateFromHsv = useCallback(
    (h: number, s: number, v: number) => {
      const rgb = hsvToRgb(h, s, v);
      setLocalRgb(rgb);
      onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
    },
    [onChange]
  );

  const handleSquareInteraction = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!squareRef.current) return;
      const rect = squareRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      updateFromHsv(hue, x, 1 - y);
    },
    [hue, updateFromHsv]
  );

  const handleHueInteraction = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newHue = x * 360;
      setHue(newHue);
      const hsv = rgbToHsv(localRgb.r, localRgb.g, localRgb.b);
      updateFromHsv(newHue, hsv.s, hsv.v);
    },
    [localRgb, updateFromHsv]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSquare.current || isDraggingHue.current) {
        e.preventDefault(); // Prevent text selection while dragging
      }
      if (isDraggingSquare.current) handleSquareInteraction(e);
      if (isDraggingHue.current) handleHueInteraction(e);
    };
    const handleMouseUp = () => {
      isDraggingSquare.current = false;
      isDraggingHue.current = false;
    };

    if (isOpen) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isOpen, handleSquareInteraction, handleHueInteraction]);

  const handleRgbChange = (channel: "r" | "g" | "b", val: string) => {
    const num = Number.parseInt(val, 10);
    if (Number.isNaN(num)) return;
    const clamped = Math.max(0, Math.min(255, num));
    const newRgb = { ...localRgb, [channel]: clamped };
    setLocalRgb(newRgb);
    onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
    const hsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
    if (hsv.s > 0 || hsv.v > 0) setHue(hsv.h);
  };

  const handleHexChange = (val: string) => {
    const clean = val.replace("#", "").slice(0, 6);
    if (clean.length === 6 && /^[0-9a-fA-F]{6}$/.test(clean)) {
      const rgb = hexToRgb(clean);
      setLocalRgb(rgb);
      onChange(clean.toLowerCase());
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      if (hsv.s > 0 || hsv.v > 0) setHue(hsv.h);
    }
  };

  const hsv = rgbToHsv(localRgb.r, localRgb.g, localRgb.b);
  const pureHueColor = `hsl(${hue}, 100%, 50%)`;

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        color="alternative"
        size="sm"
        onClick={toggle}
        className={twMerge(
          "p-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
          "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600",
          "hover:border-gray-400 dark:hover:border-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-primary-300",
          className
        )}
        title={title}
      >
        <span
          className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600"
          style={{ backgroundColor: `#${value}` }}
        />
      </Button>
      {isOpen &&
        position &&
        createPortal(
          <div
            data-advcolorpicker-portal
            className="no-drag fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 w-56"
            style={{ top: position.top, left: position.left }}
          >
            {/* Color square */}
            <div
              ref={squareRef}
              role="application"
              tabIndex={0}
              aria-label="Color saturation and brightness picker"
              className="relative w-full h-32 rounded cursor-crosshair mb-2"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHueColor})`,
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent text selection
                isDraggingSquare.current = true;
                handleSquareInteraction(e);
              }}
            >
              {/* Position indicator */}
              <div
                className="absolute w-3 h-3 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  backgroundColor: `#${value}`,
                }}
              />
            </div>

            {/* Hue slider */}
            <div
              ref={hueRef}
              role="slider"
              tabIndex={0}
              aria-label="Hue"
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(hue)}
              className="relative w-full h-3 rounded cursor-pointer mb-3"
              style={{
                background:
                  "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent text selection
                isDraggingHue.current = true;
                handleHueInteraction(e);
              }}
            >
              <div
                className="absolute w-3 h-3 rounded-full border-2 border-white shadow -translate-x-1/2 pointer-events-none"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  top: 0,
                  backgroundColor: pureHueColor,
                }}
              />
            </div>

            {/* RGB inputs */}
            <div className="flex gap-1 mb-3">
              <div className="flex-1">
                <label
                  htmlFor={`${inputIdPrefix}-r`}
                  className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5"
                >
                  R
                </label>
                <TextInput
                  id={`${inputIdPrefix}-r`}
                  type="number"
                  sizing="sm"
                  min={0}
                  max={255}
                  value={localRgb.r}
                  onChange={(e) => handleRgbChange("r", e.target.value)}
                  className="[&_input]:text-xs [&_input]:p-1"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor={`${inputIdPrefix}-g`}
                  className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5"
                >
                  G
                </label>
                <TextInput
                  id={`${inputIdPrefix}-g`}
                  type="number"
                  sizing="sm"
                  min={0}
                  max={255}
                  value={localRgb.g}
                  onChange={(e) => handleRgbChange("g", e.target.value)}
                  className="[&_input]:text-xs [&_input]:p-1"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor={`${inputIdPrefix}-b`}
                  className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5"
                >
                  B
                </label>
                <TextInput
                  id={`${inputIdPrefix}-b`}
                  type="number"
                  sizing="sm"
                  min={0}
                  max={255}
                  value={localRgb.b}
                  onChange={(e) => handleRgbChange("b", e.target.value)}
                  className="[&_input]:text-xs [&_input]:p-1"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor={`${inputIdPrefix}-hex`}
                  className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5"
                >
                  HEX
                </label>
                <TextInput
                  id={`${inputIdPrefix}-hex`}
                  type="text"
                  sizing="sm"
                  value={value.toUpperCase()}
                  onChange={(e) => handleHexChange(e.target.value)}
                  className="[&_input]:text-xs [&_input]:p-1"
                  maxLength={6}
                />
              </div>
            </div>

            {/* Preset colors */}
            <div className="flex gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    onChange(preset.value);
                    close();
                  }}
                  className={twMerge(
                    "w-5 h-5 rounded border border-gray-200 dark:border-gray-600 transition-transform hover:scale-110",
                    value === preset.value &&
                      "ring-2 ring-primary-500 ring-offset-1"
                  )}
                  style={{ backgroundColor: `#${preset.value}` }}
                  title={preset.label}
                />
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

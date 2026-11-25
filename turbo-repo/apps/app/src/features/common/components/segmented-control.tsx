"use client";

import type { ComponentProps, FC } from "react";
import { Tooltip } from "flowbite-react";
import { twMerge } from "tailwind-merge";

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  icon?: FC<ComponentProps<"svg">>;
  /** Shown on hover, e.g. what a role allows. */
  title?: string;
}

/**
 * A row of mutually exclusive options in one bordered box, the chosen one on
 * a grey fill: the settings pages' "Tarjetas / Lista" look.
 *
 * `kind` says what it is to assistive technology: `toggle` (pressed
 * buttons), `tabs` (switches between views) or `radio` (picks a value).
 * `md` is as tall as a small Button beside it; `sm` sits inside a row.
 * `fill` stretches it to its container's width, the options sharing it.
 * `tooltip` shows each option's `title` in the app's tooltip, on hover and
 * focus, instead of the browser's slow native one.
 */
export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
  label,
  kind = "toggle",
  size = "md",
  fill = false,
  tooltip = false,
  className,
}: Readonly<{
  options: readonly SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  label?: string;
  kind?: "toggle" | "tabs" | "radio";
  size?: "sm" | "md";
  fill?: boolean;
  tooltip?: boolean;
  className?: string;
}>) {
  const groupRole = { toggle: undefined, tabs: "tablist", radio: "radiogroup" }[
    kind
  ];
  const optionRole = { toggle: undefined, tabs: "tab", radio: "radio" }[kind];
  const stateProp = {
    toggle: "aria-pressed",
    tabs: "aria-selected",
    radio: "aria-checked",
  }[kind];
  return (
    <div
      role={groupRole}
      aria-label={label}
      className={twMerge(
        "flex shrink-0 self-start rounded-lg border border-gray-300 p-0.5 dark:border-gray-600",
        size === "md" ? "h-9" : "h-7",
        fill && "w-full self-stretch",
        className
      )}
    >
      {options.map((option) => {
        const button = (
          <button
            key={option.key}
            type="button"
            role={optionRole}
            {...{ [stateProp]: value === option.key }}
            title={tooltip ? undefined : option.title}
            onClick={() => onChange(option.key)}
            className={twMerge(
              "inline-flex items-center gap-1 rounded-md px-2.5 text-xs transition-colors",
              fill && "flex-1 justify-center gap-1.5 text-sm",
              value === option.key
                ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            {option.icon && <option.icon className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        );
        if (!tooltip || !option.title) return button;
        return (
          <Tooltip
            key={option.key}
            content={option.title}
            className="max-w-xs text-xs"
            theme={{ target: twMerge("flex", fill && "flex-1") }}
          >
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
}

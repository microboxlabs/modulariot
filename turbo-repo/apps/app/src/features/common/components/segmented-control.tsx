"use client";

import { useRef, type ComponentProps, type FC, type KeyboardEvent } from "react";
import { Tooltip } from "flowbite-react";
import { twMerge } from "tailwind-merge";

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  icon?: FC<ComponentProps<"svg">>;
  /** Shown on hover, e.g. what a role allows. */
  title?: string;
}

type SegmentKind = "toggle" | "tabs" | "radio";

function getNavigationIndex(
  key: string,
  index: number,
  count: number,
  kind: "tabs" | "radio"
): number | undefined {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight" || (kind === "radio" && key === "ArrowDown")) {
    return (index + 1) % count;
  }
  if (key === "ArrowLeft" || (kind === "radio" && key === "ArrowUp")) {
    return (index + count - 1) % count;
  }
  return undefined;
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
  kind?: SegmentKind;
  size?: "sm" | "md";
  fill?: boolean;
  tooltip?: boolean;
  className?: string;
}>) {
  const optionButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const groupRole = { toggle: undefined, tabs: "tablist", radio: "radiogroup" }[
    kind
  ];
  const optionRole = { toggle: undefined, tabs: "tab", radio: "radio" }[kind];
  const stateProp = {
    toggle: "aria-pressed",
    tabs: "aria-selected",
    radio: "aria-checked",
  }[kind];

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (kind === "toggle") return;
    const nextIndex = getNavigationIndex(event.key, index, options.length, kind);
    if (nextIndex === undefined) return;
    const nextOption = options[nextIndex];
    if (!nextOption) return;
    event.preventDefault();
    optionButtons.current[nextIndex]?.focus();
    onChange(nextOption.key);
  }

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
      {options.map((option, index) => {
        const button = (
          <button
            key={option.key}
            type="button"
            role={optionRole}
            ref={(element) => {
              optionButtons.current[index] = element;
            }}
            tabIndex={kind === "toggle" || value === option.key ? 0 : -1}
            {...{ [stateProp]: value === option.key }}
            title={tooltip ? undefined : option.title}
            onClick={() => onChange(option.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
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

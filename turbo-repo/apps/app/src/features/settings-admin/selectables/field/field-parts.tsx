"use client";

import { ComboboxOption } from "@headlessui/react";
import { Badge } from "flowbite-react";
import { HiCheck, HiX } from "react-icons/hi";
import { useRegistryIcon } from "@/features/common/components/icon-picker-dropdown/use-registry-icon";
import { pickText } from "../localized";
import type { SelectableOption } from "../types";

/** Tailwind text color per badge color, for an option's icon in the list. */
const ICON_TONE: Record<string, string> = {
  gray: "text-gray-500",
  blue: "text-blue-600",
  green: "text-green-600",
  red: "text-red-600",
  yellow: "text-yellow-500",
  indigo: "text-indigo-600",
  purple: "text-purple-600",
  pink: "text-pink-600",
  cyan: "text-cyan-600",
  teal: "text-teal-600",
  lime: "text-lime-600",
};

/** An option's icon from the app's icon registry, in the option's color. */
export function OptionIcon({
  option,
  tinted = true,
}: Readonly<{ option: SelectableOption; tinted?: boolean }>) {
  const Icon = useRegistryIcon(option.icon);
  if (!Icon) return null;
  const tone = tinted ? (ICON_TONE[option.color ?? ""] ?? "text-gray-400") : "";
  return <Icon className={`h-4 w-4 shrink-0 ${tone}`} />;
}

/** A value as a Flowbite badge in the option's color: selected values and page summaries. */
export function OptionBadge({
  option,
  lang,
  removeLabel,
  onRemove,
}: Readonly<{
  option: SelectableOption;
  lang: string;
  removeLabel?: string;
  onRemove?: (value: string) => void;
}>) {
  return (
    <Badge color={option.color ?? "gray"} className="w-fit">
      <span
        className={`flex items-center gap-1 ${option.disabled ? "line-through opacity-60" : ""}`}
      >
        <OptionIcon option={option} tinted={false} />
        {pickText(option.label, lang)}
        {onRemove && (
          <button
            type="button"
            aria-label={removeLabel}
            onClick={() => onRemove(option.value)}
            className="rounded-sm opacity-70 hover:opacity-100"
          >
            <HiX className="h-3 w-3" />
          </button>
        )}
      </span>
    </Badge>
  );
}

export function OptionSectionHeader({ label }: Readonly<{ label: string }>) {
  return (
    <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </div>
  );
}

/** One option in the open list; `blocked` when the selection cap is reached. */
export function OptionRow({
  option,
  lang,
  blocked,
}: Readonly<{ option: SelectableOption; lang: string; blocked: boolean }>) {
  const description = pickText(option.description, lang);
  return (
    <ComboboxOption
      value={option.value}
      disabled={option.disabled || blocked}
      className="group flex cursor-default items-start gap-2 px-3 py-2 text-gray-900 data-[disabled]:cursor-not-allowed data-[focus]:bg-gray-100 data-[disabled]:opacity-50 dark:text-white dark:data-[focus]:bg-gray-600"
    >
      <span className="mt-0.5 w-4">
        <OptionIcon option={option} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{pickText(option.label, lang)}</span>
        {description && (
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {description}
          </span>
        )}
      </span>
      <HiCheck className="invisible mt-0.5 h-4 w-4 shrink-0 text-blue-600 group-data-[selected]:visible" />
    </ComboboxOption>
  );
}

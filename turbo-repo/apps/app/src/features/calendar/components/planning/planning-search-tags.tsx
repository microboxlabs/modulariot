"use client";

// Drag-and-drop imports commented out - will be used later
// import { useState, useRef } from "react";
import { HiX } from "react-icons/hi";
import { FaTruck, FaMapMarkerAlt, FaCalendarAlt } from "react-icons/fa";
import { twMerge } from "tailwind-merge";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";

type MatchType =
  | "id"
  | "cliente"
  | "origen"
  | "destino"
  | "lugarCarguio"
  | "permanencia"
  | "tipoViaje";

export interface SearchTag {
  matchType: MatchType;
  value: string;
}

export interface PlanningSearchTagsProps {
  dict: I18nDictionary;
  tags: SearchTag[];
  onTagsChange: (tags: SearchTag[]) => void;
}

const getMatchTypeLabel = (
  matchType: MatchType,
  dict: I18nDictionary
): string => {
  const labels: Record<MatchType, string> = {
    id: tr("pages.planning.sidebar.search.matchType.id", dict),
    cliente: tr("pages.planning.sidebar.search.matchType.cliente", dict),
    origen: tr("pages.planning.sidebar.search.matchType.origen", dict),
    destino: tr("pages.planning.sidebar.search.matchType.destino", dict),
    lugarCarguio: tr(
      "pages.planning.sidebar.search.matchType.lugarCarguio",
      dict
    ),
    permanencia: tr(
      "pages.planning.sidebar.search.matchType.permanencia",
      dict
    ),
    tipoViaje: tr("pages.planning.sidebar.search.matchType.tipoViaje", dict),
  };
  const label = labels[matchType];
  // Capitalize first letter
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Helper to get translated location code or return original if not found
const getLocationLabel = (code: string, dict: I18nDictionary): string => {
  const locationKey = `pages.planning.sidebar.search.locationCodes.${code}`;
  const translated = trDynamic(locationKey, dict);
  // If translation exists and is different from key, return it; otherwise return original code
  return translated === locationKey ? code : translated;
};

// Helper to get translated value based on match type
const getTranslatedValue = (
  matchType: MatchType,
  value: string,
  dict: I18nDictionary
): string => {
  // Translate location codes for origen and destino
  if (matchType === "origen" || matchType === "destino") {
    return getLocationLabel(value, dict);
  }
  // For other types, return value as is (or add more translation logic as needed)
  return value;
};

const getMatchTypeIcon = (matchType: MatchType): React.ReactNode => {
  const iconClassName = "w-3.5 h-3.5 text-blue-700 dark:text-blue-300";
  const icons: Record<MatchType, React.ReactNode> = {
    id: <FaTruck className={iconClassName} />,
    cliente: <FaTruck className={iconClassName} />,
    origen: <FaMapMarkerAlt className={iconClassName} />,
    destino: <FaMapMarkerAlt className={iconClassName} />,
    lugarCarguio: <FaMapMarkerAlt className={iconClassName} />,
    permanencia: <FaCalendarAlt className={iconClassName} />,
    tipoViaje: <FaTruck className={iconClassName} />,
  };
  return icons[matchType];
};

export function PlanningSearchTags({
  dict,
  tags,
  onTagsChange,
}: Readonly<PlanningSearchTagsProps>) {
  // Drag-and-drop functionality commented out - will be used later
  // const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  // const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleRemove = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    onTagsChange(newTags);
  };

  const getTagKey = (tag: SearchTag, index: number): string => {
    return `${tag.matchType}-${tag.value}-${index}`;
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, index) => (
        <div
          key={getTagKey(tag, index)}
          // Drag-and-drop functionality commented out - will be used later
          // draggable
          // onDragStart={(e) => handleDragStart(e, index)}
          // onDragOver={(e) => handleDragOver(e, index)}
          // onDragLeave={handleDragLeave}
          // onDrop={(e) => handleDrop(e, index)}
          // onDragEnd={handleDragEnd}
          className={twMerge(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
            "bg-blue-50 dark:bg-blue-900/30",
            "border border-blue-200 dark:border-blue-700",
            // "cursor-move transition-all", // cursor-move commented out
            "transition-all",
            "text-sm",
            // draggedIndex === index
            //   ? "opacity-50 scale-95"
            //   : dragOverIndex === index
            //   ? "bg-blue-100 dark:bg-blue-800/40 border-blue-300 dark:border-blue-600 scale-105"
            //   :
            "hover:bg-blue-100 dark:hover:bg-blue-800/40"
          )}
        >
          {/* Drag handle indicator - commented out for now */}
          {/* <div className="flex flex-col gap-0.5 opacity-50">
            <div className="w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
            <div className="w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
          </div> */}

          {/* Icon commented out - showing attribute:value instead */}
          {/* <span className="text-base">{getMatchTypeIcon(tag.matchType)}</span> */}
          <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
            {getMatchTypeLabel(tag.matchType, dict)}: {tag.value}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(index);
            }}
            className="ml-0.5 p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
            aria-label={tr("pages.planning.sidebar.search.clear", dict)}
          >
            <HiX className="w-3 h-3 text-blue-700 dark:text-blue-300" />
          </button>
        </div>
      ))}
    </div>
  );
}

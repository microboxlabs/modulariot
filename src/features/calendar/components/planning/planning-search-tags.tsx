"use client";

import { useState, useRef } from "react";
import { HiX } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

type MatchType = "id" | "cliente" | "origen" | "destino" | "lugarCarguio" | "permanencia" | "tipoViaje";

export interface SearchTag {
  matchType: MatchType;
  value: string;
}

export interface PlanningSearchTagsProps {
  dict: I18nDictionary;
  tags: SearchTag[];
  onTagsChange: (tags: SearchTag[]) => void;
}

const getMatchTypeLabel = (matchType: MatchType, dict: I18nDictionary): string => {
  const labels: Record<MatchType, string> = {
    id: tr("pages.planning.sidebar.search.matchType.id", dict),
    cliente: tr("pages.planning.sidebar.search.matchType.cliente", dict),
    origen: tr("pages.planning.sidebar.search.matchType.origen", dict),
    destino: tr("pages.planning.sidebar.search.matchType.destino", dict),
    lugarCarguio: tr("pages.planning.sidebar.search.matchType.lugarCarguio", dict),
    permanencia: tr("pages.planning.sidebar.search.matchType.permanencia", dict),
    tipoViaje: tr("pages.planning.sidebar.search.matchType.tipoViaje", dict),
  };
  return labels[matchType];
};

const getMatchTypeIcon = (matchType: MatchType): string => {
  const icons: Record<MatchType, string> = {
    id: "🚚",
    cliente: "👤",
    origen: "🛣️",
    destino: "🛣️",
    lugarCarguio: "🛣️",
    permanencia: "📋",
    tipoViaje: "🛣️",
  };
  return icons[matchType];
};

export function PlanningSearchTags({
  dict,
  tags,
  onTagsChange,
}: Readonly<PlanningSearchTagsProps>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleRemove = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    onTagsChange(newTags);
  };

  const getTagKey = (tag: SearchTag, index: number): string => {
    return `${tag.matchType}-${tag.value}-${index}`;
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    e.dataTransfer.effectAllowed = "move";
    // Use a custom drag image (invisible)
    const dragImage = document.createElement("div");
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newTags = [...tags];
    const draggedTag = newTags[draggedIndex];
    newTags.splice(draggedIndex, 1);
    newTags.splice(dropIndex, 0, draggedTag);

    onTagsChange(newTags);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, index) => (
        <div
          key={getTagKey(tag, index)}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={twMerge(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
            "bg-blue-50 dark:bg-blue-900/30",
            "border border-blue-200 dark:border-blue-700",
            "cursor-move transition-all",
            "text-sm",
            draggedIndex === index
              ? "opacity-50 scale-95"
              : dragOverIndex === index
              ? "bg-blue-100 dark:bg-blue-800/40 border-blue-300 dark:border-blue-600 scale-105"
              : "hover:bg-blue-100 dark:hover:bg-blue-800/40"
          )}
        >
          {/* Drag handle indicator */}
          <div className="flex flex-col gap-0.5 opacity-50">
            <div className="w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
            <div className="w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
          </div>

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
